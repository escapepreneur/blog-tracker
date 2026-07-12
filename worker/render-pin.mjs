// Pinterest pin renderer — READABLE editorial style modelled on Karen's Canva pins:
// light background, small script eyebrow, BIG bold dark headline (high contrast), short
// subtitle, teal "Read the post" button, solid teal footer with white logo + domain.
// No text over busy photos. 1000x1500 Chromium screenshot. Two layouts, rotated by seed.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = dirname(fileURLToPath(import.meta.url));
const b64 = (p) => readFileSync(join(DIR, p)).toString('base64');
const ESC_BOLD = b64('assets/esc-bold.woff2');
const MARTHIN = b64('assets/marthin.woff2');
const LOGOS = { esc: b64('assets/logo.png'), nms: b64('assets/logo-nms.png') }; // white logos
const LOGO_W = { esc: 116, nms: 210 };
const DOMAIN = { esc: 'ESCHUB.COM', nms: 'ESCAPEPRENEUR.COM' };
const EYEBROW = { esc: 'on the blog', nms: 'no more somedays' };

const C = {
  teal: '#17A2A0', deep: '#0F6E6C', ink: '#123f3e', grey: '#5a726f',
  mint: '#E9F4F2', card: '#FFFFFF', line: '#CDE4E1',
};

const MINOR = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'or', 'over', 'the', 'to', 'vs', 'with']);
function tidyTitle(t) {
  const ws = String(t || '').trim().split(/\s+/);
  return ws.map((w, i) => (i === 0 ? w : (MINOR.has(w.toLowerCase()) ? w.toLowerCase() : w))).join(' ');
}
function seedInt(s) { let h = 0; const str = String(s || 'x'); for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0; return h; }
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const FONTS = `
@font-face{font-family:'EscBold';src:url(data:font/woff2;base64,${ESC_BOLD}) format('woff2');}
@font-face{font-family:'Marthin';src:url(data:font/woff2;base64,${MARTHIN}) format('woff2');}
*{margin:0;padding:0;box-sizing:border-box}
.canvas{width:1000px;height:1500px;position:relative;overflow:hidden;background:#fff;font-family:'Helvetica Neue',Arial,sans-serif}
.script{font-family:'Marthin';line-height:1}
.head{font-family:'EscBold';line-height:1.03;letter-spacing:.5px}
.sub{font-family:'Helvetica Neue',Arial,sans-serif;font-weight:400;line-height:1.4}
.btn{font-family:'Helvetica Neue',Arial,sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:2px;display:inline-block;border-radius:999px}
.dom{font-family:'Helvetica Neue',Arial,sans-serif;font-weight:700;letter-spacing:3px}
`;

// solid teal footer, white logo + white domain
function footer(brand) {
  const LOGO = LOGOS[brand] || LOGOS.esc, lw = LOGO_W[brand] || LOGO_W.esc;
  return `<div style="position:absolute;left:0;right:0;bottom:0;height:118px;background:${C.deep};display:flex;align-items:center;justify-content:space-between;padding:0 60px">
    <div class="dom" style="color:#fff;font-size:26px">${DOMAIN[brand] || DOMAIN.esc}</div>
    <img src="data:image/png;base64,${LOGO}" style="width:${lw}px;height:auto">
  </div>`;
}
const btn = () => `<div class="btn" style="background:${C.teal};color:#fff;font-size:24px;padding:20px 46px;box-shadow:0 6px 16px rgba(15,110,108,.25)">Read the Post</div>`;
const eyebrow = (kick) => `<div class="script" style="color:${C.teal};font-size:58px;margin-bottom:14px">${esc(kick)}</div>`;
const rule = () => `<div style="width:64px;height:4px;background:${C.teal};border-radius:2px;margin:26px 0"></div>`;

// content block shared by both layouts (centered, dark on light)
function content(kick, sub) {
  return `${eyebrow(kick)}
    <div class="head" id="t" style="color:${C.ink};font-size:96px;text-align:center"></div>
    ${rule()}
    ${sub ? `<div class="sub" style="color:${C.grey};font-size:32px;text-align:center;max-width:720px;margin-bottom:34px">${esc(sub)}</div>` : '<div style="height:8px"></div>'}
    ${btn()}`;
}

// LAYOUT A — clean white, thin teal top bar
function vLight(brand, kick, sub) {
  return `<div class="canvas" style="background:#fff">
    <div style="position:absolute;top:0;left:0;right:0;height:16px;background:${C.teal}"></div>
    <div id="box" style="position:absolute;left:96px;right:96px;top:150px;bottom:190px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center">
      ${content(kick, sub)}
    </div>
    ${footer(brand)}</div>`;
}
// LAYOUT B — mint ground with a white rounded card (text on solid panel)
function vCard(brand, kick, sub) {
  return `<div class="canvas" style="background:${C.mint}">
    <div id="box" style="position:absolute;left:70px;right:70px;top:130px;bottom:160px;background:${C.card};border-radius:40px;box-shadow:0 24px 60px rgba(15,110,108,.16);display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:80px 70px">
      ${content(kick, sub)}
    </div>
    ${footer(brand)}</div>`;
}

const LAYOUTS = [vLight, vCard];

function buildHtml({ title, kicker, sub, brand = 'esc', variant = 0 }) {
  const layout = LAYOUTS[variant % LAYOUTS.length];
  const t = tidyTitle(title);
  const body = layout(brand, kicker || EYEBROW[brand] || EYEBROW.esc, sub || '');
  return `<!doctype html><html><head><meta charset="utf-8"><style>${FONTS}</style></head><body>
${body}
<script>
const TITLE=${JSON.stringify(t)};
(async()=>{await document.fonts.ready;
  const el=document.getElementById('t'); if(el){ el.textContent=TITLE;
    const box=document.getElementById('box');
    let fs=parseInt(getComputedStyle(el).fontSize,10);
    let guard=80;
    while(guard-->0 && (el.scrollWidth>el.clientWidth+2 || box.scrollHeight>box.clientHeight+2) && fs>36){ fs-=2; el.style.fontSize=fs+'px'; }
  }
  window.__done=true;
})();
</script></body></html>`;
}

export async function renderPin({ title, tagline, brand = 'esc', seed = '', variant }) {
  const v = Number.isInteger(variant) ? variant : (seedInt(seed || title) % LAYOUTS.length);
  // eyebrow is a fixed brand line ("on the blog"); the tagline (if any) is the subtitle.
  const sub = (tagline && tagline.trim()) ? tagline.trim() : '';
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 1500 } });
    await page.setContent(buildHtml({ title, kicker: EYEBROW[brand] || EYEBROW.esc, sub, brand, variant: v }), { waitUntil: 'load' });
    await page.waitForFunction('window.__done === true', { timeout: 8000 });
    return await page.locator('.canvas').screenshot({ type: 'jpeg', quality: 90 });
  } finally {
    await browser.close();
  }
}
