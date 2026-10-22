// GET /preview/<token>  (netlify.toml rewrites it to this function with ?t=<token>)
// A read-only page that shows a DRAFT the way a reader will see it, for someone without a Blog
// Studio login (for example Karen on her phone). The token is long and random, the page is
// marked noindex, never cached (so it always shows the latest saved draft), and runs no scripts.
// Once the post is live the link redirects to the real page.
import { embedBodyImages } from './_lib/embedimages.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpprrknnkjyluhgtoezu.supabase.co';
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SAFE_HEADERS = {
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex, nofollow, noarchive',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  // No scripts at all, images only over https, and the page may not be framed anywhere.
  'content-security-policy': "default-src 'none'; img-src https: data:; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};
const html = (status, body) => ({ statusCode: status, headers: { ...SAFE_HEADERS, 'content-type': 'text/html; charset=utf-8' }, body });

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const BRAND_NAMES = { esc: 'ESC Hub', nms: 'No More Somedays' };

// The article is written by Claude, not typed by a stranger, but strip anything active anyway.
function clean(body) {
  return String(body || '')
    .replace(/<(script|style|iframe|object|embed|form|link|meta)\b[\s\S]*?(<\/\1>|\/?>)/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1=$2#$2');
}

// Give every H2 an anchor, and turn the <!-- TOC --> marker into an "In this article" list.
function withToc(body) {
  const heads = [];
  let n = 0;
  const out = body.replace(/<h2\b([^>]*)>([\s\S]*?)<\/h2>/gi, (m, attrs, inner) => {
    const id = `s${++n}`;
    heads.push({ id, text: inner.replace(/<[^>]+>/g, '').trim() });
    return `<h2${attrs} id="${id}">${inner}</h2>`;
  });
  const toc = heads.length > 2
    ? `<nav class="toc"><b>In this article</b><ol>${heads.map(h => `<li><a href="#${h.id}">${esc(h.text)}</a></li>`).join('')}</ol></nav>`
    : '';
  return /<!--\s*TOC\s*-->/i.test(out) ? out.replace(/<!--\s*TOC\s*-->/i, toc) : out;
}

function notFound() {
  return html(404, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Preview not available</title>
<style>body{font-family:system-ui,sans-serif;background:#f1f8f8;color:#1a1a1a;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px}main{max-width:420px;text-align:center}h1{font-size:20px;margin:0 0 8px}p{color:#5c5c5c;line-height:1.6;margin:0}</style></head>
<body><main><h1>This preview link isn't active</h1><p>It may have been turned off, or the address is wrong. Ask whoever sent it for a new link.</p></main></body></html>`);
}

export const handler = async (event) => {
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'HEAD') return { statusCode: 405, headers: SAFE_HEADERS, body: 'GET only' };
  // The token is the last part of the address that was asked for (/preview/<token>). Read it from
  // there first: the rewrite's ?t= value did not always arrive. ?t= still works if called directly.
  const fromPath = (s) => { const m = String(s || '').match(/\/preview\/([A-Za-z0-9_-]+)/); return m ? m[1] : ''; };
  const token = (fromPath(event.rawUrl) || fromPath(event.path) || String((event.queryStringParameters && event.queryStringParameters.t) || '')).replace(/\/+$/, '');
  if (!SKEY || !/^[A-Za-z0-9_-]{32,64}$/.test(token)) return notFound();

  const h = { apikey: SKEY, Authorization: `Bearer ${SKEY}` };
  try {
    const [draft] = await (await fetch(`${SUPABASE_URL}/rest/v1/post_drafts?share_token=eq.${token}&select=post_id,body_html,assets,generated_at&limit=1`, { headers: h })).json();
    if (!draft) return notFound();
    const [post] = await (await fetch(`${SUPABASE_URL}/rest/v1/posts?id=eq.${draft.post_id}&select=blog,status,url,title,subtitle,primary_keyword`, { headers: h })).json();
    if (!post) return notFound();

    if (post.status === 'live' && post.url) {
      return { statusCode: 302, headers: { ...SAFE_HEADERS, location: post.url }, body: '' };
    }

    const a = draft.assets || {};
    const title = a.title || post.title || post.primary_keyword || 'Untitled draft';
    const brand = BRAND_NAMES[post.blog] || 'Blog';
    const body = withToc(clean(embedBodyImages(draft.body_html, a.body_images)));
    const saved = draft.generated_at ? new Date(draft.generated_at).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/New_York' }) + ' (New York time)' : 'recently';

    return html(200, `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive"><meta name="referrer" content="no-referrer">
<title>Draft preview: ${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--teal:#209a9b;--ink:#1a1a1a;--grey:#5c5c5c;--tint:#e9f7f7;--ground:#f1f8f8}
*{box-sizing:border-box}
body{margin:0;background:#fff;color:var(--ink);font-family:'Poppins',system-ui,-apple-system,'Segoe UI',sans-serif;font-size:17px;line-height:1.75;-webkit-text-size-adjust:100%}
.bar{position:sticky;top:0;z-index:5;background:#fff6e0;border-bottom:1px solid #efd48f;color:#7a4f00;font-size:13px;line-height:1.5;padding:9px max(16px,env(safe-area-inset-left,0px)) 9px max(16px,env(safe-area-inset-right,0px));text-align:center}
.bar b{font-weight:600}
.top{background:var(--teal);color:#fff;padding:14px max(16px,env(safe-area-inset-left,0px));font-weight:600;letter-spacing:.01em}
.wrap{max-width:740px;margin:0 auto;padding:36px max(18px,env(safe-area-inset-left,0px)) 80px max(18px,env(safe-area-inset-right,0px))}
.kicker{font-size:13px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--teal);margin:0 0 10px}
h1{font-size:clamp(28px,5.5vw,40px);line-height:1.18;font-weight:700;margin:0 0 12px;text-wrap:balance}
.sub{font-size:19px;color:var(--grey);margin:0 0 22px}
.hero{display:block;width:100%;height:auto;border-radius:10px;margin:8px 0 30px}
.body h2{font-size:clamp(22px,4vw,28px);line-height:1.25;font-weight:600;margin:42px 0 12px;scroll-margin-top:60px;text-wrap:balance}
.body h3{font-size:19px;font-weight:600;margin:28px 0 8px}
.body p{margin:0 0 18px}
.body ul,.body ol{margin:0 0 20px;padding-left:24px}
.body li{margin:6px 0}
.body a{color:#188bf6}
.body img{max-width:100%;height:auto}
.body figure{margin:28px 0}
.toc{background:var(--tint);border-radius:10px;padding:18px 22px;margin:26px 0;font-size:15px;line-height:1.55}
.toc b{display:block;margin-bottom:6px}
.toc ol{margin:0;padding-left:20px}
.toc a{color:var(--ink);text-decoration:none}
.toc a:hover{text-decoration:underline}
.note{margin-top:48px;padding:16px 18px;background:var(--ground);border-radius:10px;color:var(--grey);font-size:14px;line-height:1.6}
</style></head><body>
<div class="bar"><b>Draft preview.</b> Not published yet. Last saved ${esc(saved)}. Reload the page to see the latest changes.</div>
<div class="top">${esc(brand)}</div>
<main class="wrap">
  <p class="kicker">${esc(brand)} blog</p>
  <h1>${esc(title)}</h1>
  ${post.subtitle ? `<p class="sub">${esc(post.subtitle)}</p>` : ''}
  ${a.featured_image_url ? `<img class="hero" src="${esc(a.featured_image_url)}" alt="">` : ''}
  <article class="body">${body}</article>
  <p class="note">The published page also shows the standard call-to-action buttons below the article. This preview shows the article only.</p>
</main></body></html>`);
  } catch (e) {
    return html(500, '<!doctype html><meta name="robots" content="noindex"><p style="font-family:system-ui;padding:24px">Something went wrong loading this preview. Please try again in a moment.</p>');
  }
};
