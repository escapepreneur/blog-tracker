// Pinterest pin renderer — bold, text-forward, on-brand. One layout, rotating background
// palette (teal / deep teal / near-black / cream). Everything LEFT-aligned: logo top-left,
// a pill eyebrow, a SHORT punchy multi-line headline (bold sans + Marthin script accent),
// a small subline, CTA + arrow. 1000x1500 Chromium screenshot.
//
// Headline model: `lines` = ordered array of { t, s } where s:true renders that line in the
// Marthin script accent, else bold EscBold. The whole stack auto-fits to the biggest font
// where every line fits the width AND the stack fills the available height (measured with
// hidden per-font measurers — the same reliable technique the featured renderer uses).
// This supports 1-3 line headlines and the "vs" layout (Product / vs / Product).
// If no `lines` are given it falls back to splitting a headline/title into bold + script.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = dirname(fileURLToPath(import.meta.url));
const b64 = (p) => readFileSync(join(DIR, p)).toString('base64');
const ESC_BOLD = b64('assets/esc-bold.woff2');
const MARTHIN = b64('assets/marthin.woff2');
const LOGO_WHITE = { esc: b64('assets/logo.png'), nms: b64('assets/logo-nms.png') };
const LOGO_TEAL = b64('assets/logo-teal.png');
const DOMAIN = { esc: 'ESCHUB.COM', nms: 'ESCAPEPRENEUR.COM' };
const EYEBROW = { esc: 'On The Blog', nms: 'No More Somedays' };

// Background palettes + the eyebrow-pill colours (complementary/contrasting per bg).
const PALETTES = [
  { key: 'teal',     dark: true,  bg: '#209A9B', text: '#FFFFFF', accent: '#FFFFFF', ctaBg: '#FFFFFF', ctaText: '#0F5C5A', pillBg: '#FFFFFF', pillText: '#0F6E6C', dom: 'rgba(255,255,255,.9)',  b1: 'rgba(255,255,255,.08)', b2: 'rgba(0,0,0,.05)' },
  { key: 'deepteal', dark: true,  bg: '#0F5C5A', text: '#FFFFFF', accent: '#7FE3E1', ctaBg: '#7FE3E1', ctaText: '#0F5C5A', pillBg: '#7FE3E1', pillText: '#0F5C5A', dom: 'rgba(255,255,255,.8)',  b1: 'rgba(255,255,255,.06)', b2: 'rgba(127,227,225,.14)' },
  { key: 'ink',      dark: true,  bg: '#1A1A1A', text: '#FFFFFF', accent: '#29ABAC', ctaBg: '#29ABAC', ctaText: '#FFFFFF', pillBg: '#29ABAC', pillText: '#FFFFFF', dom: 'rgba(255,255,255,.7)',  b1: 'rgba(255,255,255,.05)', b2: 'rgba(41,171,172,.16)' },
  { key: 'cream',    dark: false, bg: '#FAF9F7', text: '#0F5C5A', accent: '#209A9B', ctaBg: '#209A9B', ctaText: '#FFFFFF', pillBg: '#209A9B', pillText: '#FFFFFF', dom: '#8A9694',              b1: 'rgba(32,154,155,.07)', b2: 'rgba(32,154,155,.05)' },
];

function tidyTitle(t) { return String(t || '').replace(/\s+/g, ' ').trim(); }
function seedInt(s) { let h = 0; const str = String(s || 'x'); for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0; return h; }
function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }
function tooSimilar(a, b) {
  const t = norm(a), s = norm(b);
  if (!s) return true;
  if (t.includes(s) || s.includes(t)) return true;
  const ts = new Set(t.split(' ')); const ss = s.split(' ').filter(Boolean);
  return ss.filter(w => ts.has(w)).length / Math.max(1, ss.length) >= 0.7;
}
// Fallback headline/subline from a full title (used when no explicit lines are stored):
// split at the first :/?/— ; headline = front, subline = rest.
function fromTitle(raw) {
  const t = tidyTitle(raw);
  const m = t.match(/^(.+?)([?:|–—])\s+(.+)$/);
  if (m) return { headline: (m[2] === '?' ? m[1] + '?' : m[1]).trim(), subline: m[3].trim() };
  return { headline: t, subline: '' };
}

const FONTS = `
@font-face{font-family:'EscBold';src:url(data:font/woff2;base64,${ESC_BOLD}) format('woff2');}
@font-face{font-family:'Marthin';src:url(data:font/woff2;base64,${MARTHIN}) format('woff2');}
*{margin:0;padding:0;box-sizing:border-box}
.canvas{width:1000px;height:1500px;position:relative;overflow:hidden;font-family:'EscBold'}
.eyebrow{font-family:'EscBold';text-transform:uppercase;letter-spacing:3px;display:inline-block;border-radius:999px;font-size:26px;padding:14px 30px}
.sub{font-family:'EscBold';font-weight:400;line-height:1.24;text-wrap:balance}
.pill{font-family:'EscBold';text-transform:uppercase;letter-spacing:1.6px;display:inline-block;border-radius:999px}
.dom{font-family:'EscBold';letter-spacing:2px}
`;

function logoTag(pal, brand) {
  if (pal.dark) {
    if (brand === 'nms') return `<img src="data:image/png;base64,${LOGO_WHITE.nms}" style="width:400px;height:auto;display:block">`;
    return `<img src="data:image/png;base64,${LOGO_WHITE.esc}" style="height:76px;width:auto;display:block">`;
  }
  return `<img src="data:image/png;base64,${LOGO_TEAL}" style="height:96px;width:auto;display:block">`;
}

function vBold(pal, brand, eyebrow, sub, cta) {
  return `<div class="canvas" style="background:${pal.bg}">
    <div style="position:absolute;top:-150px;right:-150px;width:470px;height:470px;border-radius:50%;background:${pal.b1}"></div>
    <div style="position:absolute;bottom:-130px;left:-170px;width:520px;height:520px;border-radius:50%;background:${pal.b2}"></div>
    <div style="position:absolute;top:68px;left:58px">${logoTag(pal, brand)}</div>
    <div class="content" style="position:absolute;top:210px;left:58px;right:58px;bottom:200px;display:flex;flex-direction:column;justify-content:center;text-align:left">
      <div class="eyebrow-wrap" style="margin-bottom:24px"><span class="eyebrow" style="background:${pal.pillBg};color:${pal.pillText}">&#10022;&nbsp; ${eyebrow}</span></div>
      <div id="stack"></div>
      ${sub ? `<div class="sub" style="color:${pal.text};opacity:.92;font-size:48px;margin-top:30px">${sub}</div>` : ''}
    </div>
    <div style="position:absolute;left:58px;bottom:88px"><div class="pill" style="background:${pal.ctaBg};color:${pal.ctaText};font-size:26px;padding:22px 50px">${cta} &nbsp;&rarr;</div></div>
    <div style="position:absolute;right:64px;bottom:96px" class="dom"><span style="color:${pal.dom};font-size:23px">${DOMAIN[brand] || DOMAIN.esc}</span></div>
  </div>`;
}

function buildHtml({ lines, headline, sub, eyebrow, cta, brand, pal }) {
  const body = vBold(pal, brand, eyebrow || '', sub || '', cta || 'Read the post');
  return `<!doctype html><html><head><meta charset="utf-8"><style>${FONTS}</style></head><body>
${body}
<script>
const LINES=${JSON.stringify(Array.isArray(lines) ? lines : [])};
const HEADLINE=${JSON.stringify(headline || '')};
const COL_TEXT=${JSON.stringify(pal.text)}, COL_ACCENT=${JSON.stringify(pal.accent)};
(async()=>{await document.fonts.ready;
  const stack=document.getElementById('stack');
  const box=stack.parentElement;                 // .content (fixed height via top/bottom)
  // hidden per-font measurers (real offsetWidth — reliable)
  const mk=(ff,ls)=>{ const s=document.createElement('span');
    s.style.cssText='position:absolute;left:-9999px;top:-9999px;visibility:hidden;white-space:nowrap;font-weight:700;font-family:'+ff+';letter-spacing:'+ls; document.body.appendChild(s); return s; };
  const mB=mk("'EscBold'",'1px'), mS=mk("'Marthin'",'3px');
  const wOf=(t,fs,scr)=>{ const m=scr?mS:mB; m.style.fontSize=fs+'px'; m.textContent=t; return m.offsetWidth; };

  // If no explicit lines, derive them from HEADLINE: 1 word -> single bold line; else split
  // into bold (keyword) + script (accent) at the point that lets the font grow biggest.
  let L=LINES.slice();
  if(!L.length){
    const words=HEADLINE.split(/\\s+/).filter(Boolean);
    if(words.length<=1){ L=[{t:HEADLINE,s:false}]; }
    else{ let best=null;
      for(let k=1;k<words.length;k++){ const a=words.slice(0,k).join(' '),b=words.slice(k).join(' ');
        const w=Math.max(wOf(a,200,false),wOf(b,190,true)); if(!best||w<best.w)best={a,b,w}; }
      L=[{t:best.a,s:false},{t:best.b,s:true}]; }
  }

  const MAXW_B=862, MAXW_S=812, SCRIPT=0.98, MAXCAP=300, MIN=52;
  const lh=(l)=> l.s?1.07:1.02;                  // per-line height factor
  const eb=box.querySelector('.eyebrow-wrap'), subEl=box.querySelector('.sub');
  const availH=box.clientHeight - (eb?eb.offsetHeight:0) - (subEl?subEl.offsetHeight:0) - 78;
  const heightFactor=L.reduce((a,l)=> a + lh(l)*(l.s?SCRIPT:1), 0);
  const fits=(f)=>{
    for(const l of L){ const fs=l.s?Math.round(f*SCRIPT):f; if(wOf(l.t,fs,l.s)>(l.s?MAXW_S:MAXW_B)) return false; }
    return true;
  };
  let f=Math.min(MAXCAP, Math.floor(availH/heightFactor));
  while(f>MIN && !fits(f)) f-=2;

  // paint the stack
  for(const l of L){
    const fs=l.s?Math.round(f*SCRIPT):f;
    const s=document.createElement('span');
    s.textContent=l.t;
    s.style.cssText='display:block;white-space:nowrap;color:'+(l.s?COL_ACCENT:COL_TEXT)+';font-size:'+fs+'px;'+
      (l.s ? "font-family:'Marthin';font-weight:400;line-height:1.07;letter-spacing:3px;margin-left:-4px;"
           : "font-family:'EscBold';font-weight:700;line-height:1.02;letter-spacing:1px;");
    stack.appendChild(s);
  }
  window.__done=true;
})();
</script></body></html>`;
}

export async function renderPin({ title, tagline, headline, subline, lines, sub, brand = 'esc', seed = '', variant, palette }) {
  const pals = brand === 'nms' ? PALETTES.filter(p => p.dark) : PALETTES;
  let pal;
  if (palette) pal = PALETTES.find(p => p.key === palette) || pals[0];
  else { const i = Number.isInteger(variant) ? variant : seedInt(seed || title); pal = pals[i % pals.length]; }

  // Prefer an explicit line stack; else fall back to a headline/title split.
  const hasLines = Array.isArray(lines) && lines.filter(l => l && l.t && String(l.t).trim()).length;
  let useLines = hasLines ? lines.map(l => ({ t: tidyTitle(l.t), s: !!l.s })) : null;
  let head = '', subOut = sub && sub.trim() ? tidyTitle(sub) : '';
  if (!useLines) {
    head = headline && headline.trim() ? tidyTitle(headline) : '';
    if (!head) { const f = fromTitle(title); head = f.headline; if (!subOut) subOut = f.subline; }
    if (!subOut && subline && subline.trim()) subOut = tidyTitle(subline);
    if (!subOut && tagline && tagline.trim() && !tooSimilar(head, tagline)) subOut = tagline.trim();
  }

  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 1500 } });
    await page.setContent(buildHtml({ lines: useLines, headline: head, sub: subOut, eyebrow: EYEBROW[brand] || EYEBROW.esc, cta: 'Read the post', brand, pal }), { waitUntil: 'load' });
    await page.waitForFunction('window.__done === true', { timeout: 8000 });
    return await page.locator('.canvas').screenshot({ type: 'jpeg', quality: 88 });
  } finally {
    await browser.close();
  }
}
