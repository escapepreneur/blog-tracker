#!/usr/bin/env node
// status-sync: publish scheduled posts on their date + keep tracker status in sync.
//  - GHL-managed posts (have ghl_post_id, created by "Schedule"): on scheduled_date, PUBLISH the GHL
//    post (PUT status=PUBLISHED + featured image) and flip the tracker to live.
//  - Legacy posts (no ghl_post_id): flip to live on date, verifying the URL when present.
// Default is a DRY RUN; pass --live to actually publish/write.
//  - Indexing: on go-live, ask Google to crawl the URL (Indexing API); each run also
//    flips Indexed no/requested -> yes once Search Console confirms. Needs GOOGLE_SA_KEY.
//   env: SUPABASE_SERVICE_ROLE_KEY, GHL_API_TOKEN, GOOGLE_SA_KEY (optional)
import { publishBlogPost } from '../netlify/functions/_lib/ghl.mjs';
import { BRANDS } from '../netlify/functions/_lib/brands.mjs';
import { requestIndexing, inspectIndexed, getServiceAccount } from '../netlify/functions/_lib/google.mjs';
import { postPinsForPost, blotatoConfigured } from '../netlify/functions/_lib/blotato.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpprrknnkjyluhgtoezu.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PIT = process.env.GHL_API_TOKEN;
const LIVE = process.argv.includes('--live');
if (!KEY) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
const h = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const rest = (q, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: h, ...opts });

async function getScheduled() {
  const r = await rest(`posts?status=eq.scheduled&select=id,blog,title,primary_keyword,scheduled_date,published_date,url,ghl_post_id`);
  if (!r.ok) throw new Error(`fetch scheduled failed: ${r.status} ${await r.text()}`);
  return r.json();
}
async function getFeatured(postId) {
  const [d] = await (await rest(`post_drafts?post_id=eq.${postId}&select=assets`)).json();
  return (d && d.assets && d.assets.featured_image_url) || null;
}
async function setLive(post, goLiveDate) {
  const body = { status: 'live', confirmed_live: true };
  if (!post.published_date) body.published_date = goLiveDate || today;
  const r = await rest(`posts?id=eq.${post.id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`patch ${post.id} failed: ${r.status} ${await r.text()}`);
}
async function verifyLive(url) {
  try { return (await fetch(url, { method: 'GET', redirect: 'follow' })).status; }
  catch (e) { return `error: ${e.message}`; }
}

(async () => {
  console.log(`[status-sync] ${LIVE ? 'LIVE' : 'DRY-RUN'}  today=${today}`);
  const posts = await getScheduled();
  console.log(`[status-sync] ${posts.length} scheduled post(s)`);
  let published = 0, flipped = 0, waiting = 0, failed = 0;
  for (const p of posts) {
    const label = `[${p.blog}] ${p.title || p.primary_keyword || p.id}`;
    const goLive = p.scheduled_date || p.published_date;
    if (!goLive)        { console.log(`  WAIT  (no date)            ${label}`); waiting++; continue; }
    if (goLive > today) { console.log(`  WAIT  (${goLive} > today)  ${label}`); waiting++; continue; }

    if (p.ghl_post_id) {                       // GHL-managed -> publish live on its date
      if (!PIT) { console.log(`  HOLD  (no GHL_API_TOKEN)   ${label}`); waiting++; continue; }
      console.log(`  PUBLISH  ${label}  (ghl ${p.ghl_post_id})`);
      if (LIVE) {
        try {
          const img = await getFeatured(p.id);
          await publishBlogPost({ ghlPostId: p.ghl_post_id, pit: PIT, brand: p.blog, imageUrl: img, imageAltText: p.title || p.primary_keyword });
          await setLive(p, goLive);
          published++;
          if (p.url) { try { await requestIndexing(p.url); await rest(`posts?id=eq.${p.id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ indexed: 'requested' }) }); } catch (e) { /* indexing best-effort */ } }
        } catch (e) { console.error(`  FAIL publish ${label}: ${e.message}`); failed++; }
      } else published++;
      continue;
    }

    // legacy posts (no ghl_post_id)
    if (p.url) {
      const st = await verifyLive(p.url);
      if (st !== 200) { console.log(`  HOLD  (url ${st})  ${label}`); waiting++; continue; }
      console.log(`  FLIP  (url 200)  ${label}`);
    } else console.log(`  FLIP  (date reached, no url)  ${label}`);
    if (LIVE) await setLive(p, goLive);
    flipped++;
  }
  // Indexing-status tracking: flip live posts to indexed=yes once Search Console confirms.
  let indexedFlipped = 0;
  if (LIVE && getServiceAccount()) {
    const livePosts = await (await rest(`posts?status=eq.live&indexed=neq.yes&url=not.is.null&select=id,blog,url,primary_keyword`)).json();
    for (const p of (Array.isArray(livePosts) ? livePosts : [])) {
      const prop = BRANDS[p.blog] && BRANDS[p.blog].gscProperty;
      if (!prop) continue;
      try {
        const st = await inspectIndexed(prop, p.url);
        if (st === 'yes') { await rest(`posts?id=eq.${p.id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ indexed: 'yes' }) }); indexedFlipped++; }
      } catch (e) { /* per-post best-effort */ }
    }
    console.log(`[status-sync] indexing: ${indexedFlipped} post(s) flipped to indexed=yes`);
  }

  // Pinterest auto-posting: live posts with a rendered pin that haven't been pinned yet ->
  // pin to their topic board + brand blog board via Blotato, then mark pinterest_posted.
  let pinned = 0;
  if (LIVE && blotatoConfigured()) {
    const rows = await (await rest(`posts?status=eq.live&pinterest_posted=eq.false&url=not.is.null&select=id,blog,title,primary_keyword,url,cluster`)).json();
    for (const p of (Array.isArray(rows) ? rows : [])) {
      const [d] = await (await rest(`post_drafts?post_id=eq.${p.id}&select=assets,meta_description`)).json();
      if (!d || !d.assets || !d.assets.pin_image_url) continue; // pin not rendered yet — try again next run
      try {
        const res = await postPinsForPost({ brand: p.blog, post: p, draft: d });
        const ok = res.posted && res.posted.some(x => !x.error);
        if (ok) {
          await rest(`posts?id=eq.${p.id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ pinterest_posted: true }) });
          pinned++;
          console.log(`  PIN  [${p.blog}] ${p.title || p.primary_keyword} -> ${res.posted.map(x => x.board + (x.error ? ' (ERR)' : '')).join(', ')}`);
        } else {
          console.log(`  PIN-SKIP  [${p.blog}] ${p.title || p.primary_keyword}: ${res.skipped || (res.posted || []).map(x => x.error).join('; ')}`);
        }
      } catch (e) { console.error(`  FAIL pin ${p.id}: ${e.message}`); }
    }
    console.log(`[status-sync] pinterest: ${pinned} post(s) pinned`);
  }

  console.log(`[status-sync] done. published=${published} flipped=${flipped} waiting=${waiting} failed=${failed}`);
})().catch(e => { console.error('[status-sync] FAILED:', e.message); process.exit(1); });
