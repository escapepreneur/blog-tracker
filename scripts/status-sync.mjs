#!/usr/bin/env node
// status-sync: publish scheduled posts on their date + keep tracker status in sync.
//  - GHL-managed posts (have ghl_post_id, created by "Schedule"): on scheduled_date, PUBLISH the GHL
//    post (PUT status=PUBLISHED + featured image) and flip the tracker to live.
//  - Legacy posts (no ghl_post_id): flip to live on date, verifying the URL when present.
// Default is a DRY RUN; pass --live to actually publish/write.
//  - Indexing: on go-live, ask Google to crawl the URL (Indexing API); each run also
//    flips Indexed no/requested -> yes once Search Console confirms. Needs GOOGLE_SA_KEY.
//   env: SUPABASE_SERVICE_ROLE_KEY, GHL_API_TOKEN, GOOGLE_SA_KEY (optional)
import { getBlogPostDetail, getBlogPostBySlug } from '../netlify/functions/_lib/ghl.mjs';
import { publishDue, goLiveAt } from '../netlify/functions/_lib/publishdue.mjs';
import { alertHtml, sendAlert } from '../netlify/functions/_lib/alertmail.mjs';
import { BRANDS } from '../netlify/functions/_lib/brands.mjs';
import { requestIndexing, inspectIndexed, getServiceAccount } from '../netlify/functions/_lib/google.mjs';
import { syncInternalLinks } from '../netlify/functions/_lib/linksync.mjs';
import { syncInternalLinks as reconcileLinksFromBody } from '../netlify/functions/_lib/links.mjs';
import { dispatchFeaturedRender } from '../netlify/functions/_lib/dispatch.mjs';

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

  // GHL-managed posts: publish once their go-live moment (15:00 SAST on the scheduled date)
  // has passed. The Netlify function publish-due does this every 5 minutes and is the primary
  // publisher; this run is the fallback. If it ends up publishing anything an hour or more
  // after the go-live moment, the primary missed it, so email Karen (an independent signal
  // from the Netlify watchdog, which only checks at 16:00 SAST).
  if (PIT) {
    const res = await publishDue({ rest, h, pit: PIT, live: LIVE });
    published += res.published.length; failed += res.failed.length; waiting += res.waiting;
    const late = res.published.filter(x => x.at && Date.parse(x.at) - goLiveAt(x.goLive) > 60 * 60000);
    if (late.length || res.failed.length) {
      const items = [
        ...late.map(x => `<b>${x.label}</b> only went live at ${new Date(x.at).toISOString().slice(11, 16)} UTC, over an hour after its 3pm SAST time.`),
        ...res.failed.map(x => `<b>${x.label}</b> could not be published: ${x.error}`),
      ];
      try {
        await sendAlert({
          subject: `⚠️ Scheduled post ${late.length ? 'went live late' : 'failed to publish'}`,
          html: alertHtml({ intro: 'The automatic 3pm SAST publish did not do its job for:', items, note: 'The backup daily run caught this. Worth checking that the every-5-minutes publisher is still running.' }),
        });
      } catch (e) { console.error(`  could not send late-publish email: ${e.message}`); }
    }
  } else if (posts.some(p => p.ghl_post_id)) console.log('  HOLD  (no GHL_API_TOKEN) GHL-managed posts not published');

  for (const p of posts) {
    const label = `[${p.blog}] ${p.title || p.primary_keyword || p.id}`;
    const goLive = p.scheduled_date || p.published_date;
    if (!goLive)        { console.log(`  WAIT  (no date)            ${label}`); waiting++; continue; }
    if (goLive > today) { console.log(`  WAIT  (${goLive} > today)  ${label}`); waiting++; continue; }

    if (p.ghl_post_id) continue;               // GHL-managed posts were handled by publishDue above

    // legacy posts (no ghl_post_id)
    if (p.url) {
      const st = await verifyLive(p.url);
      if (st !== 200) { console.log(`  HOLD  (url ${st})  ${label}`); waiting++; continue; }
      console.log(`  FLIP  (url 200)  ${label}`);
    } else console.log(`  FLIP  (date reached, no url)  ${label}`);
    if (LIVE) {
      await setLive(p, goLive);
      try { await syncInternalLinks({ rest, h, blog: p.blog, postId: p.id }); } catch (e) { /* best-effort */ }
    }
    flipped++;
  }
  // Indexing tracking + self-healing:
  //  - flip live posts to indexed=yes once Search Console confirms;
  //  - for posts still not indexed after a couple of days, verify the page is actually
  //    serving (200) then RE-REQUEST indexing. Catches the publish-day 404 (Google
  //    crawled before the page was live and cached the 404) + nudges anything the first
  //    request didn't take. Capped at 30 days — past that, re-nudging isn't the problem.
  let indexedFlipped = 0, reRequested = 0;
  if (LIVE && getServiceAccount()) {
    const livePosts = await (await rest(`posts?status=eq.live&indexed=neq.yes&url=not.is.null&select=id,blog,url,primary_keyword,published_date,scheduled_date`)).json();
    for (const p of (Array.isArray(livePosts) ? livePosts : [])) {
      const prop = BRANDS[p.blog] && BRANDS[p.blog].gscProperty;
      if (!prop) continue;
      try {
        const st = await inspectIndexed(prop, p.url);
        if (st === 'yes') {
          await rest(`posts?id=eq.${p.id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ indexed: 'yes' }) });
          indexedFlipped++;
          continue;
        }
        // still not indexed — re-nudge if it's been live 2-30 days and the page is up
        const liveDate = p.published_date || p.scheduled_date;
        const ageDays = liveDate ? Math.floor((Date.parse(today) - Date.parse(liveDate)) / 86400000) : null;
        if (ageDays != null && ageDays >= 2 && ageDays <= 30) {
          const code = await verifyLive(p.url);
          if (code === 200) { await requestIndexing(p.url); reRequested++; console.log(`  RE-INDEX  [${p.blog}] ${p.primary_keyword || p.url} (live ${ageDays}d, not yet indexed)`); }
        }
      } catch (e) { /* per-post best-effort */ }
    }
    console.log(`[status-sync] indexing: ${indexedFlipped} flipped to yes, ${reRequested} re-requested`);
  }

  // Featured-image render self-heal: the render worker is triggered via a one-shot
  // repository_dispatch right after generation; if that silently failed (bad/expired
  // GITHUB_DISPATCH_TOKEN, GitHub API hiccup) nothing ever retries since the workflow has
  // no schedule trigger of its own, so a post can sit stuck indefinitely. Catch anything
  // still pending after 20+ minutes and re-dispatch. Needs GITHUB_DISPATCH_TOKEN as a repo secret.
  const GH_TOKEN = process.env.GITHUB_DISPATCH_TOKEN;
  let reDispatched = 0;
  if (LIVE && GH_TOKEN) {
    const cutoff = new Date(Date.now() - 20 * 60000).toISOString();
    const stuck = await (await rest(`post_drafts?assets->>featured_image_search=not.is.null&assets->>featured_image_url=is.null&generated_at=lt.${cutoff}&select=post_id,generated_at`)).json();
    for (const row of (Array.isArray(stuck) ? stuck : [])) {
      await dispatchFeaturedRender(row.post_id, GH_TOKEN);
      reDispatched++;
      console.log(`  RE-DISPATCH featured image  ${row.post_id} (pending since ${row.generated_at})`);
    }
    if (reDispatched) console.log(`[status-sync] featured images: ${reDispatched} stuck render(s) re-dispatched`);
  }

  // Title backfill: live posts with no tracker title -> pull it from the GHL post (by
  // ghl_post_id, else by url slug). Fixes older posts + is a permanent safety net so the
  // tracker title always matches what's published.
  let titled = 0;
  if (LIVE && PIT) {
    const live = await (await rest(`posts?status=eq.live&url=not.is.null&select=id,blog,url,title,ghl_post_id`)).json();
    for (const p of (Array.isArray(live) ? live : [])) {
      if (p.title && p.title.trim()) continue;
      try {
        let ghlId = p.ghl_post_id;
        if (!ghlId) {
          const slug = (p.url.split('/post/')[1] || '').replace(/[?#].*$/, '').replace(/\/+$/, '');
          const f = slug ? await getBlogPostBySlug({ brand: p.blog, slug, pit: PIT }) : null;
          ghlId = f && (f._id || f.id);
        }
        if (!ghlId) continue;
        const d = await getBlogPostDetail({ ghlPostId: ghlId, pit: PIT });
        if (d && d.title) {
          const body = { title: d.title };
          if (!p.ghl_post_id) body.ghl_post_id = ghlId;
          await rest(`posts?id=eq.${p.id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify(body) });
          titled++;
        }
      } catch (e) { /* per-post best-effort */ }
    }
    console.log(`[status-sync] titles: ${titled} backfilled from GHL`);
  }

  // Internal-links reconciliation self-heal: syncInternalLinks (links.mjs, parses the real
  // <a href> tags out of the body) runs right after every generate/cluster-publish, but if
  // that one call ever fails silently — as it did for two historical cluster launches, whose
  // real in-body links never made it into the tracker — nothing ever retries it, so a post's
  // links stay invisible to the "Needs Links" widget indefinitely. Catch any live post with
  // ZERO tracked outbound links and re-sync it straight from the live GHL body, so a future
  // gap like this self-heals here instead of sitting silent for weeks.
  let reconciled = 0;
  if (LIVE && PIT) {
    const live = await (await rest(`posts?status=eq.live&url=not.is.null&select=id,blog,url,ghl_post_id`)).json();
    const tracked = await (await rest(`internal_links?from_post_id=not.is.null&select=from_post_id`)).json();
    const hasOutbound = new Set((Array.isArray(tracked) ? tracked : []).map(r => r.from_post_id));
    const gaps = (Array.isArray(live) ? live : []).filter(p => !hasOutbound.has(p.id));
    for (const p of gaps) {
      try {
        let ghlId = p.ghl_post_id;
        if (!ghlId) {
          const slug = (p.url.split('/post/')[1] || '').replace(/[?#].*$/, '').replace(/\/+$/, '');
          const f = slug ? await getBlogPostBySlug({ brand: p.blog, slug, pit: PIT }) : null;
          ghlId = f && (f._id || f.id);
        }
        if (!ghlId) continue;
        const detail = await getBlogPostDetail({ ghlPostId: ghlId, pit: PIT });
        const { added } = await reconcileLinksFromBody({ supabaseUrl: SUPABASE_URL, headers: h, postId: p.id, brand: p.blog, bodyHtml: detail.rawHTML || '' });
        if (added) { reconciled += added; console.log(`  RECONCILE-LINKS  [${p.blog}] ${p.url} (+${added})`); }
      } catch (e) { /* per-post best-effort */ }
    }
    if (reconciled) console.log(`[status-sync] links: ${reconciled} untracked link(s) reconciled`);
  }

  console.log(`[status-sync] done. published=${published} flipped=${flipped} waiting=${waiting} failed=${failed}`);
})().catch(e => { console.error('[status-sync] FAILED:', e.message); process.exit(1); });
