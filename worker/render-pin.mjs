// Pinterest pin renderer. HTML + brand fonts -> Chromium screenshot -> 1000x1500 JPEG.
// Runs in GitHub Actions (Chromium). Vertical 2:3 pin styled on Karen's brand + Canva pin
// layouts: full-bleed background, dark overlay, inset frame, teal eyebrow, big white+teal
// title, script tagline, centered logo + domain footer.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = dirname(fileURLToPath(import.meta.url));
const b64 = (p) => readFileSync(join(DIR, p)).toString('base64');
const ESC_BOLD = b64('assets/esc-bold.woff2');
const MARTHIN = b64('assets/marthin.woff2');
const LOGOS = { esc: b64('assets/logo.png'), nms: b64('assets/logo-nms.png') };
const LOGO_W = { esc: 190, nms: 340 };
const EYEBROW = { esc: 'ESC HUB', nms: 'NO MORE SOMEDAYS' };
const DOMAIN = { esc: 'eschub.com/blog', nms: 'escapepreneur.com/blog' };

const MINOR = new Set(['a','an','and','as','at','but','by','for','from','in','into','of','on','or','over','the','to','vs','with']);
function tidyTitle(t) {
  const ws = String(t || '').trim().split(/\s+/);
  return ws.map((w, i) => (i === 0 ? w : (MINOR.has(w.toLowerCase()) ? w.toLowerCase() : w))).join(' ');
}

function buildHtml({ title, tagline, bgBase64, brand = 'esc' }) {
  const LOGO = LOGOS[brand] || LOGOS.esc;
  const logoW = LOGO_W[brand] || LOGO_W.esc;
  const eyebrow = EYEBROW[brand] || EYEBROW.esc;
  const domain = DOMAIN[brand] || DOMAIN.esc;
  title = tidyTitle(title);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'EscBold';src:url(data:font/woff2;base64,${ESC_BOLD}) format('woff2');}
@font-face{font-family:'Marthin';src:url(data:font/woff2;base64,${MARTHIN}) format('woff2');}
*{margin:0;padding:0;box-sizing:border-box}
.canvas{width:1000px;height:1500px;position:relative;overflow:hidden;background:#222}
.bg{position:absolute;inset:0;background:url(data:image/jpeg;base64,${bgBase64}) center/cover}
.overlay{position:absolute;inset:0;background:rgba(0,0,0,.55)}
.frame{position:absolute;inset:36px;border:2px solid rgba(255,255,255,.65)}
.content{position:absolute;left:96px;right:96px;top:120px;bottom:300px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;overflow:hidden}
.eyebrow{font-family:'EscBold';color:#29abab;letter-spacing:5px;text-transform:uppercase;font-size:28px;margin-bottom:30px}
.title{font-family:'EscBold';line-height:1.06;letter-spacing:-1px}
.white{color:#fff}.teal{color:#29abab}
.rule{width:96px;height:4px;background:#29abab;margin:34px 0}
.tagline{font-family:'Marthin';color:#fff;line-height:1.08}
.footer{position:absolute;left:0;right:0;bottom:90px;display:flex;flex-direction:column;align-items:center;gap:18px}
.logo{width:${logoW}px;height:auto}
.domain{font-family:'EscBold';color:#fff;letter-spacing:1.5px;font-size:26px;opacity:.92}
</style></head><body>
<div class="canvas">
  <div class="bg"></div><div class="overlay"></div><div class="frame"></div>
  <div class="content" id="content">
    <div class="eyebrow">${eyebrow}</div>
    <div class="title" id="title"></div>
    <div class="rule"></div>
    <div class="tagline" id="tag"></div>
  </div>
  <div class="footer"><img class="logo" src="data:image/png;base64,${LOGO}"><div class="domain">${domain}</div></div>
</div>
<script>
const TITLE=${JSON.stringify(title || '')}, TAGLINE=${JSON.stringify(tagline || '')};
// split the title into two balanced halves -> first white, second teal (brand look)
function split(text){const ws=text.split(' ');if(ws.length<2)return[text,''];const mid=Math.ceil(ws.length/2);return[ws.slice(0,mid).join(' '),ws.slice(mid).join(' ')];}
(async()=>{await document.fonts.ready;
  const content=document.getElementById('content');
  const titleEl=document.getElementById('title');
  const tagEl=document.getElementById('tag');
  const[a,b]=split(TITLE);
  titleEl.innerHTML='<span class="white">'+a+'</span> <span class="teal">'+b+'</span>';
  tagEl.textContent=TAGLINE;
  let fs=104;                                  // shrink title (and tagline with it) until it fits the content box
  titleEl.style.fontSize=fs+'px';tagEl.style.fontSize=Math.round(fs*0.6)+'px';
  while(content.scrollHeight>content.clientHeight&&fs>42){fs-=3;titleEl.style.fontSize=fs+'px';tagEl.style.fontSize=Math.round(fs*0.6)+'px';}
  window.__done=true;
})();
</script></body></html>`;
}

export async function renderPin({ title, tagline, bgBase64, brand = 'esc' }) {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 1500 } });
    await page.setContent(buildHtml({ title, tagline, bgBase64, brand }), { waitUntil: 'load' });
    await page.waitForFunction('window.__done === true', { timeout: 8000 });
    return await page.locator('.canvas').screenshot({ type: 'jpeg', quality: 88 });
  } finally {
    await browser.close();
  }
}
