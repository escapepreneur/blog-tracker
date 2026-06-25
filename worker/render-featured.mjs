// Featured-image renderer. HTML + brand fonts -> Chromium screenshot -> 1200x560 JPEG buffer.
// Runs in GitHub Actions (Chromium). Design matches the ESC Hub Canva template.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = dirname(fileURLToPath(import.meta.url));
const b64 = (p) => readFileSync(join(DIR, p)).toString('base64');
const ESC_BOLD = b64('assets/esc-bold.woff2');
const MARTHIN = b64('assets/marthin.woff2');
const LOGO = b64('assets/logo.png');

function buildHtml({ title, tagline, bgBase64 }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'EscBold';src:url(data:font/woff2;base64,${ESC_BOLD}) format('woff2');}
@font-face{font-family:'Marthin';src:url(data:font/woff2;base64,${MARTHIN}) format('woff2');}
*{margin:0;padding:0;box-sizing:border-box}
.canvas{width:1200px;height:560px;position:relative;overflow:hidden;background:#222}
.bg{position:absolute;inset:0;background:url(data:image/jpeg;base64,${bgBase64}) center/cover}
.overlay{position:absolute;inset:0;background:linear-gradient(90deg,rgba(18,20,23,.74) 0%,rgba(18,20,23,.58) 45%,rgba(18,20,23,.34) 100%)}
.content{position:absolute;left:200px;right:200px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center}
.title{font-family:'EscBold';line-height:1.02;letter-spacing:-1px}
.title .l1{display:block;color:#fff;white-space:nowrap}
.title .l2{display:block;color:#29abab;white-space:nowrap}
.tagline{font-family:'Marthin';color:#fff;margin-top:22px;line-height:1;white-space:nowrap}
.logo{position:absolute;right:59px;bottom:38px;width:222px;height:auto}
#m{position:absolute;visibility:hidden;white-space:nowrap;font-family:'EscBold';letter-spacing:-1px}
</style></head><body>
<div class="canvas">
  <div class="bg"></div><div class="overlay"></div>
  <div class="content">
    <div class="title"><span class="l1" id="l1"></span><span class="l2" id="l2"></span></div>
    <div class="tagline" id="tag">${tagline || ''}</div>
  </div>
  <img class="logo" src="data:image/png;base64,${LOGO}">
  <span id="m"></span>
</div>
<script>
const TITLE=${JSON.stringify(title || '')};
const m=document.getElementById('m');
const maxW=800;        // even 200px padding both sides
const tagMax=690;      // keep tagline clear of the corner logo
function w(t,fs){m.style.fontSize=fs+'px';m.textContent=t;return m.offsetWidth}
function balance(text,fs){const ws=text.split(' ');if(ws.length<2)return[text,''];let best=null;
  for(let i=1;i<ws.length;i++){const a=ws.slice(0,i).join(' '),b=ws.slice(i).join(' ');
    const d=Math.abs(w(a,fs)-w(b,fs));if(!best||d<best.d)best={a,b,d}}return[best.a,best.b]}
(async()=>{await document.fonts.ready;
  let fs=130,a,b;
  for(;fs>=42;fs-=2){[a,b]=balance(TITLE,fs);if(Math.max(w(a,fs),w(b,fs))<=maxW)break}
  const t=document.querySelector('.title');t.style.fontSize=fs+'px';
  document.getElementById('l1').textContent=a;document.getElementById('l2').textContent=b;
  const tl=document.getElementById('tag');let ts=Math.round(fs*0.75);tl.style.fontSize=ts+'px';
  while(tl.offsetWidth>tagMax&&ts>20){ts-=2;tl.style.fontSize=ts+'px';}
  window.__done=true;
})();
</script></body></html>`;
}

export async function renderFeatured({ title, tagline, bgBase64 }) {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 560 } });
    await page.setContent(buildHtml({ title, tagline, bgBase64 }), { waitUntil: 'load' });
    await page.waitForFunction('window.__done === true', { timeout: 8000 });
    return await page.locator('.canvas').screenshot({ type: 'jpeg', quality: 90 });
  } finally {
    await browser.close();
  }
}
