// Pinterest pin renderer — flat vector style matching Karen's Canva pins (teal panel + wavy
// edge + simple scene + script kicker + bold title + CTA pill + cream footer w/ domain+logo).
// 1000x1500 Chromium screenshot. Rotates through several layouts (by a per-post seed) for variety.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = dirname(fileURLToPath(import.meta.url));
const b64 = (p) => readFileSync(join(DIR, p)).toString('base64');
const ESC_BOLD = b64('assets/esc-bold.woff2');
const MARTHIN = b64('assets/marthin.woff2');
const LOGOS = { esc: b64('assets/logo.png'), nms: b64('assets/logo-nms.png') };
const LOGO_W = { esc: 116, nms: 210 };
const DOMAIN = { esc: 'ESCHUB.COM', nms: 'ESCAPEPRENEUR.COM' };
// Brand palette (flat). teal primary; second accent for variety; scene + footer tints.
const BRAND = {
  esc: { teal: '#1AA3A0', deep: '#0F6E6C', sky: '#CFE7F0', hill: '#8FBE3F', cloud: '#FFFFFF', footer: '#EDF3F1', pill: '#FFFFFF', pillText: '#0F6E6C' },
  nms: { teal: '#1AA3A0', deep: '#0F6E6C', sky: '#F3E4DA', hill: '#E6A15C', cloud: '#FFFFFF', footer: '#F4EEE9', pill: '#FFFFFF', pillText: '#0F6E6C' },
};

const MINOR = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'or', 'over', 'the', 'to', 'vs', 'with']);
function tidyTitle(t) {
  const ws = String(t || '').trim().split(/\s+/);
  return ws.map((w, i) => (i === 0 ? w : (MINOR.has(w.toLowerCase()) ? w.toLowerCase() : w))).join(' ');
}
function seedInt(s) { let h = 0; const str = String(s || 'x'); for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0; return h; }

const FONTS = `
@font-face{font-family:'EscBold';src:url(data:font/woff2;base64,${ESC_BOLD}) format('woff2');}
@font-face{font-family:'Marthin';src:url(data:font/woff2;base64,${MARTHIN}) format('woff2');}
*{margin:0;padding:0;box-sizing:border-box}
.canvas{width:1000px;height:1500px;position:relative;overflow:hidden;background:#fff;font-family:'EscBold'}
.kick{font-family:'Marthin';line-height:1}
.ttl{font-family:'EscBold';text-transform:uppercase;line-height:1.02;letter-spacing:0.5px}
.pill{font-family:'EscBold';text-transform:uppercase;letter-spacing:1.5px;display:inline-block;border-radius:999px;font-weight:400}
.dom{font-family:'EscBold';letter-spacing:2px}
.rule{border:none;height:3px;width:120px}
`;

// shared footer bar (cream) with domain + logo
function footer(c, brand) {
  const LOGO = LOGOS[brand] || LOGOS.esc, lw = LOGO_W[brand] || LOGO_W.esc;
  return `<div style="position:absolute;left:0;right:0;bottom:0;height:96px;background:${c.footer};display:flex;align-items:center;justify-content:space-between;padding:0 56px">
    <div class="dom" style="color:${c.deep};font-size:30px">${DOMAIN[brand] || DOMAIN.esc}</div>
    <img src="data:image/png;base64,${LOGO}" style="width:${lw}px;height:auto">
  </div>`;
}
const pill = (c, text) => `<div class="pill" style="background:${c.pill};color:${c.pillText};font-size:26px;padding:20px 42px;box-shadow:0 4px 14px rgba(0,0,0,.12)">${text}</div>`;

// LAYOUT 1 — teal left panel with wavy edge + sky/cloud/hill scene on the right
function v1(c, brand, kick, title, cta) {
  return `<div class="canvas">
    <svg width="1000" height="1500" viewBox="0 0 1000 1500" style="position:absolute;inset:0">
      <rect width="1000" height="1500" fill="${c.sky}"/>
      <ellipse cx="880" cy="1360" rx="420" ry="300" fill="${c.hill}"/>
      <circle cx="820" cy="240" r="70" fill="${c.cloud}"/><circle cx="900" cy="250" r="90" fill="${c.cloud}"/><circle cx="770" cy="290" r="55" fill="${c.cloud}"/>
      <path d="M0,0 L600,0 C700,260 540,470 630,730 C710,980 560,1200 620,1500 L0,1500 Z" fill="${c.teal}"/>
    </svg>
    <div style="position:absolute;left:90px;top:150px;width:470px;bottom:150px;display:flex;flex-direction:column;justify-content:center;color:#fff">
      <div class="kick" style="font-size:64px;margin-bottom:6px">${kick}</div>
      <div class="ttl" id="t" style="font-size:76px"></div>
      <hr class="rule" style="background:#fff;margin:34px 0 40px">
      ${pill(c, cta)}
    </div>
    ${footer(c, brand)}
  </div>`;
}
// LAYOUT 2 — scene on top, teal panel on the bottom with a wavy top edge
function v2(c, brand, kick, title, cta) {
  return `<div class="canvas">
    <svg width="1000" height="1500" viewBox="0 0 1000 1500" style="position:absolute;inset:0">
      <rect width="1000" height="1500" fill="${c.sky}"/>
      <circle cx="230" cy="250" r="120" fill="${c.cloud}" opacity="0.9"/><circle cx="360" cy="270" r="80" fill="${c.cloud}" opacity="0.9"/>
      <ellipse cx="140" cy="720" rx="260" ry="190" fill="${c.hill}" opacity="0.85"/>
      <path d="M0,720 C240,640 360,820 620,760 C820,712 900,820 1000,780 L1000,1500 L0,1500 Z" fill="${c.teal}"/>
    </svg>
    <div style="position:absolute;left:90px;right:90px;top:820px;bottom:150px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;color:#fff">
      <div class="kick" style="font-size:58px;margin-bottom:6px">${kick}</div>
      <div class="ttl" id="t" style="font-size:74px;text-align:center"></div>
      <div style="margin-top:38px">${pill(c, cta)}</div>
    </div>
    ${footer(c, brand)}
  </div>`;
}
// LAYOUT 3 — solid teal with soft decorative rings, centered title
function v3(c, brand, kick, title, cta) {
  return `<div class="canvas">
    <svg width="1000" height="1500" viewBox="0 0 1000 1500" style="position:absolute;inset:0">
      <rect width="1000" height="1500" fill="${c.teal}"/>
      <circle cx="120" cy="180" r="150" fill="none" stroke="#fff" stroke-width="3" opacity="0.18"/>
      <circle cx="930" cy="470" r="90" fill="none" stroke="#fff" stroke-width="3" opacity="0.18"/>
      <circle cx="880" cy="1180" r="200" fill="none" stroke="#fff" stroke-width="3" opacity="0.15"/>
    </svg>
    <div style="position:absolute;left:110px;right:110px;top:130px;bottom:150px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;color:#fff">
      <div class="kick" style="font-size:62px;margin-bottom:10px">${kick}</div>
      <div class="ttl" id="t" style="font-size:82px;text-align:center"></div>
      <hr class="rule" style="background:#fff;margin:38px 0 42px">
      ${pill(c, cta)}
    </div>
    ${footer(c, brand)}
  </div>`;
}
// LAYOUT 4 — white rounded card on a teal ground
function v4(c, brand, kick, title, cta) {
  return `<div class="canvas">
    <svg width="1000" height="1500" viewBox="0 0 1000 1500" style="position:absolute;inset:0">
      <rect width="1000" height="1500" fill="${c.teal}"/>
      <ellipse cx="850" cy="200" rx="220" ry="160" fill="#fff" opacity="0.08"/>
      <ellipse cx="150" cy="1250" rx="260" ry="200" fill="#fff" opacity="0.08"/>
    </svg>
    <div style="position:absolute;left:80px;right:80px;top:150px;bottom:150px;background:#fff;border-radius:36px;box-shadow:0 20px 50px rgba(0,0,0,.15);display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:70px">
      <div class="kick" style="font-size:60px;color:${c.deep};margin-bottom:8px">${kick}</div>
      <div class="ttl" id="t" style="font-size:78px;color:${c.deep};text-align:center"></div>
      <hr class="rule" style="background:${c.teal};margin:36px 0 40px">
      ${pill(c, cta)}
    </div>
    ${footer(c, brand)}
  </div>`;
}

const LAYOUTS = [v1, v2, v3, v4];

function buildHtml({ title, kicker, cta, brand = 'esc', variant = 0 }) {
  const c = BRAND[brand] || BRAND.esc;
  const layout = LAYOUTS[variant % LAYOUTS.length];
  const t = tidyTitle(title);
  const body = layout(c, brand, kicker || '', t, cta || 'Read the post');
  return `<!doctype html><html><head><meta charset="utf-8"><style>${FONTS}</style></head><body>
${body}
<script>
const TITLE=${JSON.stringify(t)};
(async()=>{await document.fonts.ready;
  const el=document.getElementById('t'); if(el){ el.textContent=TITLE;
    let fs=parseInt(getComputedStyle(el).fontSize,10);
    // shrink to fit its container box
    const box=el.parentElement;
    let guard=60;
    while(guard-->0 && (el.scrollWidth>el.clientWidth+2 || box.scrollHeight>box.clientHeight+2) && fs>34){ fs-=2; el.style.fontSize=fs+'px'; }
  }
  window.__done=true;
})();
</script></body></html>`;
}

export async function renderPin({ title, tagline, brand = 'esc', seed = '', variant }) {
  const v = Number.isInteger(variant) ? variant : (seedInt(seed || title) % LAYOUTS.length);
  // kicker: use the short tagline in script if present, else a brand-y lead-in
  const kicker = (tagline && tagline.trim()) ? tagline.trim() : (brand === 'nms' ? 'no more somedays' : 'on the blog');
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 1500 } });
    await page.setContent(buildHtml({ title, kicker, cta: 'Read the post', brand, variant: v }), { waitUntil: 'load' });
    await page.waitForFunction('window.__done === true', { timeout: 8000 });
    return await page.locator('.canvas').screenshot({ type: 'jpeg', quality: 88 });
  } finally {
    await browser.close();
  }
}
