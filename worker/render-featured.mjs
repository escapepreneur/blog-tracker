// Featured-image renderer. HTML + brand fonts -> Chromium screenshot -> 1200x560 JPEG buffer.
// Runs in GitHub Actions (Chromium). Design matches Karen's ESC Hub Canva template:
// left-aligned, white+teal title (one line if short, two if longer), script tagline, 60% overlay, corner logo.
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
.overlay{position:absolute;inset:0;background:rgba(0,0,0,.6)}
.content{position:absolute;left:200px;right:140px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;text-align:left}
.title{font-family:'EscBold';line-height:1.04;letter-spacing:-1px}
.white{color:#fff}.teal{color:#29abab}
.tagline{font-family:'Marthin';color:#fff;line-height:1;margin-top:14px}
.logo{position:absolute;right:50px;bottom:40px;width:150px;height:auto}
#m{position:absolute;visibility:hidden;white-space:nowrap;font-family:'EscBold';letter-spacing:-1px}
</style></head><body>
<div class="canvas">
  <div class="bg"></div><div class="overlay"></div>
  <div class="content"><div class="title" id="title"></div><div class="tagline" id="tag"></div></div>
  <img class="logo" src="data:image/png;base64,${LOGO}">
  <span id="m"></span>
</div>
<script>
const TITLE=${JSON.stringify(title || '')}, TAGLINE=${JSON.stringify(tagline || '')};
const m=document.getElementById('m');
const MAXW=860, MAXFONT=88;
function w(t,fs){m.style.fontSize=fs+'px';m.textContent=t;return m.offsetWidth}
function split(text){const ws=text.split(' ');if(ws.length<2)return[text,''];let best=null;
  for(let i=1;i<ws.length;i++){const a=ws.slice(0,i).join(' '),b=ws.slice(i).join(' ');
    const d=Math.abs(w(a,MAXFONT)-w(b,MAXFONT));if(!best||d<best.d)best={a,b,d}}return[best.a,best.b]}
(async()=>{await document.fonts.ready;
  const[a,b]=split(TITLE);
  const titleEl=document.getElementById('title');
  let fs;
  if(w(TITLE,MAXFONT)<=MAXW){           // fits on ONE line -> one line, white + teal inline
    fs=MAXFONT;
    titleEl.innerHTML='<span class="white">'+a+'</span> <span class="teal">'+b+'</span>';
  }else{                                // TWO lines, fit each line to width
    fs=MAXFONT;while(Math.max(w(a,fs),w(b,fs))>MAXW&&fs>44)fs-=2;
    titleEl.innerHTML='<span class="white" style="display:block">'+a+'</span><span class="teal" style="display:block">'+b+'</span>';
  }
  titleEl.style.fontSize=fs+'px';
  const tl=document.getElementById('tag');let ts=Math.round(fs*0.66);tl.textContent=TAGLINE;tl.style.fontSize=ts+'px';
  while(tl.offsetWidth>780&&ts>26){ts-=2;tl.style.fontSize=ts+'px';} // keep tagline clear of the corner logo
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
