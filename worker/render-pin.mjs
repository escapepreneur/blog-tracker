// Pinterest pin renderer — bold, text-forward, on-brand. One layout, rotating background
// palette within the brand's teal family + neutrals. Logo top; two-line title split as
// EVENLY as possible with the important part in bold sans and the trailing/less-important
// part in Marthin script; subheading; CTA with arrow. 1000x1500 Chromium screenshot.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = dirname(fileURLToPath(import.meta.url));
const b64 = (p) => readFileSync(join(DIR, p)).toString('base64');
const ESC_BOLD = b64('assets/esc-bold.woff2');
const MARTHIN = b64('assets/marthin.woff2');
const LOGO_WHITE = { esc: b64('assets/logo.png'), nms: b64('assets/logo-nms.png') };
const LOGO_TEAL = b64('assets/logo-teal.png');   // teal esc HUB badge for light backgrounds
const DOMAIN = { esc: 'ESCHUB.COM', nms: 'ESCAPEPRENEUR.COM' };
const EYEBROW = { esc: 'On The Blog', nms: 'No More Somedays' };

// On-brand backgrounds only — teal family + neutrals (exact brand hex). Light bgs use the
// teal badge logo + deep-teal text; dark bgs use the white mark + white text. NMS uses the
// dark palettes only (its white wordmark has no light-bg version).
const PALETTES = [
  { key: 'teal',     dark: true,  bg: '#209A9B', text: '#FFFFFF', accent: '#FFFFFF', ctaBg: '#FFFFFF', ctaText: '#0F5C5A', dom: 'rgba(255,255,255,.9)',  b1: 'rgba(255,255,255,.08)', b2: 'rgba(0,0,0,.05)' },
  { key: 'deepteal', dark: true,  bg: '#0F5C5A', text: '#FFFFFF', accent: '#7FE3E1', ctaBg: '#FFFFFF', ctaText: '#0F5C5A', dom: 'rgba(255,255,255,.8)',  b1: 'rgba(255,255,255,.06)', b2: 'rgba(41,171,172,.18)' },
  { key: 'ink',      dark: true,  bg: '#1A1A1A', text: '#FFFFFF', accent: '#29ABAC', ctaBg: '#29ABAC', ctaText: '#FFFFFF', dom: 'rgba(255,255,255,.7)',  b1: 'rgba(255,255,255,.05)', b2: 'rgba(41,171,172,.16)' },
  { key: 'cream',    dark: false, bg: '#FAF9F7', text: '#0F5C5A', accent: '#209A9B', ctaBg: '#209A9B', ctaText: '#FFFFFF', dom: '#8A9694',              b1: 'rgba(32,154,155,.07)', b2: 'rgba(32,154,155,.05)' },
];

function tidyTitle(t) { return String(t || '').replace(/\s+/g, ' ').trim(); }
function splitTitle(raw) {
  const t = String(raw || '').replace(/\s+/g, ' ').trim();
  const m = t.match(/^(.+?)([?:|–—])\s+(.+)$/);
  if (m) return { main: (m[2] === '?' ? m[1] + '?' : m[1]).trim(), sub: m[3].trim() };
  return { main: t, sub: '' };
}
function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }
function tooSimilar(a, b) {
  const t = norm(a), s = norm(b);
  if (!s) return true;
  if (t.includes(s) || s.includes(t)) return true;
  const ts = new Set(t.split(' ')); const ss = s.split(' ').filter(Boolean);
  return ss.filter(w => ts.has(w)).length / Math.max(1, ss.length) >= 0.7;
}
function seedInt(s) { let h = 0; const str = String(s || 'x'); for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0; return h; }

const FONTS = `
@font-face{font-family:'EscBold';src:url(data:font/woff2;base64,${ESC_BOLD}) format('woff2');}
@font-face{font-family:'Marthin';src:url(data:font/woff2;base64,${MARTHIN}) format('woff2');}
*{margin:0;padding:0;box-sizing:border-box}
.canvas{width:1000px;height:1500px;position:relative;overflow:hidden;font-family:'EscBold'}
.kick{font-family:'Marthin';line-height:1}
#t{font-family:'EscBold';font-weight:700}
.l1{font-family:'EscBold';font-weight:700;line-height:1.0;letter-spacing:.3px;white-space:nowrap}
.l2{font-family:'Marthin';font-weight:400;line-height:1.04;white-space:nowrap;margin-top:.06em}
.sub{font-family:'EscBold';font-weight:400;line-height:1.26;text-wrap:balance}
.pill{font-family:'EscBold';text-transform:uppercase;letter-spacing:1.6px;display:inline-block;border-radius:999px}
.dom{font-family:'EscBold';letter-spacing:2px}
`;

function logoTag(pal, brand) {
  if (pal.dark) {
    // NMS = wide "escapepreneur" wordmark -> size by WIDTH; ESC = squarish badge -> by height
    if (brand === 'nms') return `<img src="data:image/png;base64,${LOGO_WHITE.nms}" style="width:440px;height:auto;display:block">`;
    return `<img src="data:image/png;base64,${LOGO_WHITE.esc}" style="height:80px;width:auto;display:block">`;
  }
  return `<img src="data:image/png;base64,${LOGO_TEAL}" style="width:196px;height:auto;display:block">`;
}

function vBold(pal, brand, kick, sub, cta) {
  return `<div class="canvas" style="background:${pal.bg}">
    <div style="position:absolute;top:-150px;right:-150px;width:470px;height:470px;border-radius:50%;background:${pal.b1}"></div>
    <div style="position:absolute;bottom:-130px;left:-170px;width:520px;height:520px;border-radius:50%;background:${pal.b2}"></div>
    <div style="position:absolute;top:74px;left:0;right:0;display:flex;justify-content:center">${logoTag(pal, brand)}</div>
    <div style="position:absolute;top:200px;left:58px;right:58px;bottom:200px;display:flex;flex-direction:column;justify-content:center;text-align:left">
      <div class="kick" style="color:${pal.accent};font-size:78px;margin-bottom:10px;opacity:.95">${kick}</div>
      <div id="t"><span class="l1" style="color:${pal.text};display:block;font-size:158px"></span><span class="l2" style="color:${pal.accent};display:block;font-size:150px"></span></div>
      ${sub ? `<div class="sub" style="color:${pal.text};opacity:.92;font-size:60px;margin-top:34px">${sub}</div>` : ''}
    </div>
    <div style="position:absolute;left:80px;bottom:90px"><div class="pill" style="background:${pal.ctaBg};color:${pal.ctaText};font-size:26px;padding:22px 50px">${cta} &nbsp;&rarr;</div></div>
    <div style="position:absolute;right:66px;bottom:98px" class="dom"><span style="color:${pal.dom};font-size:23px">${DOMAIN[brand] || DOMAIN.esc}</span></div>
  </div>`;
}

function buildHtml({ title, kicker, sub, cta, brand, pal }) {
  const t = tidyTitle(title);
  const body = vBold(pal, brand, kicker || '', sub || '', cta || 'Read the post');
  return `<!doctype html><html><head><meta charset="utf-8"><style>${FONTS}</style></head><body>
${body}
<script>
const TITLE=${JSON.stringify(t)};
(async()=>{await document.fonts.ready;
  const box=document.getElementById('t').parentElement;
  const l1=document.querySelector('.l1'), l2=document.querySelector('.l2');
  const words=TITLE.split(/\\s+/);
  const setSplit=(k)=>{ l1.textContent=words.slice(0,k).join(' '); l2.textContent=words.slice(k).join(' '); };
  // sizes: l2 (script) tracks l1 (bold) at a fixed ratio
  const RATIO=0.95; let base=158;
  const apply=(fs)=>{ l1.style.fontSize=fs+'px'; l2.style.fontSize=Math.round(fs*RATIO)+'px'; };
  if(words.length<=1){ l1.textContent=TITLE; l2.style.display='none'; }
  else{
    // pick the split that makes the two lines closest in width (evenest), at a probe size
    apply(base); let bestK=1, bestDiff=Infinity;
    for(let k=1;k<words.length;k++){ setSplit(k); const d=Math.abs(l1.scrollWidth-l2.scrollWidth); if(d<bestDiff){bestDiff=d;bestK=k;} }
    setSplit(bestK);
  }
  // grow to fill: enlarge until a line exceeds the width or the whole block (kicker +
  // title + subheading) fills the zone height, then back off just enough to fit.
  let fs=base, guard=170; apply(fs);
  const overflow=()=> l1.scrollWidth>box.clientWidth || (l2.style.display!=='none' && l2.scrollWidth>box.clientWidth) || box.scrollHeight>box.clientHeight+1;
  while(guard-->0 && !overflow() && fs<340){ fs+=4; apply(fs); }        // grow to fill
  while(guard-->0 && overflow() && fs>40){ fs-=3; apply(fs); }          // then back off to fit
  window.__done=true;
})();
</script></body></html>`;
}

export async function renderPin({ title, tagline, brand = 'esc', seed = '', variant, palette }) {
  const pals = brand === 'nms' ? PALETTES.filter(p => p.dark) : PALETTES;
  let pal;
  if (palette) pal = PALETTES.find(p => p.key === palette) || pals[0];
  else { const i = Number.isInteger(variant) ? variant : seedInt(seed || title); pal = pals[i % pals.length]; }
  const { main, sub: subFromTitle } = splitTitle(title);
  let sub = subFromTitle;
  if (!sub && tagline && tagline.trim() && !tooSimilar(main, tagline)) sub = tagline.trim();
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 1500 } });
    await page.setContent(buildHtml({ title: main, kicker: EYEBROW[brand] || EYEBROW.esc, sub, cta: 'Read the post', brand, pal }), { waitUntil: 'load' });
    await page.waitForFunction('window.__done === true', { timeout: 8000 });
    return await page.locator('.canvas').screenshot({ type: 'jpeg', quality: 88 });
  } finally {
    await browser.close();
  }
}
