// Publishes scheduled posts whose go-live moment has passed. Shared by the Netlify scheduler
// (publish-due, every 5 minutes) and the GitHub status-sync run (fallback), so both behave the
// same and either one can safely run at any time: a post that is already live is never touched.
//
// Go-live moment = the post's scheduled date at 15:00 SAST (13:00 UTC, South Africa has no DST).
// The old daily job only ever ran once, so its own start time was the only time gate. With a
// frequent trigger the gate has to be explicit, or posts would go out at midnight.
import { publishBlogPost } from './ghl.mjs';
import { requestIndexing } from './google.mjs';
import { syncInternalLinks } from './linksync.mjs';

export const GO_LIVE_HOUR_UTC = 13;
export const goLiveAt = (ymd) => Date.parse(`${ymd}T${String(GO_LIVE_HOUR_UTC).padStart(2, '0')}:00:00Z`);

async function verifyLive(url) {
  try { return (await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(8000) })).status; }
  catch (e) { return `error: ${e.message}`; }
}

export async function getDueScheduled({ rest, now = Date.now() }) {
  const r = await rest(`posts?status=eq.scheduled&select=id,blog,title,primary_keyword,scheduled_date,published_date,url,ghl_post_id`);
  if (!r.ok) throw new Error(`fetch scheduled failed: ${r.status} ${await r.text()}`);
  const rows = await r.json();
  const due = [], waiting = [];
  for (const p of rows) {
    const goLive = p.scheduled_date || p.published_date;
    (goLive && goLiveAt(goLive) <= now ? due : waiting).push({ ...p, goLive });
  }
  return { due, waiting };
}

// Returns { published: [{label, goLive, at}], waiting, failed: [{label, error}], skipped }.
export async function publishDue({ rest, h, pit, live = true, now = Date.now(), budgetMs = 18000, log = console.log }) {
  const started = Date.now();
  const out = { published: [], waiting: 0, failed: [], skipped: 0 };
  if (!pit) throw new Error('Missing GHL_API_TOKEN');
  const { due, waiting } = await getDueScheduled({ rest, now });
  out.waiting = waiting.length;
  for (const p of due) {
    const label = `[${p.blog}] ${p.title || p.primary_keyword || p.id}`;
    if (!p.ghl_post_id) { out.skipped++; continue; } // legacy posts are flipped by status-sync
    if (Date.now() - started > budgetMs) { log(`  BUDGET  out of time, ${label} left for the next run`); out.skipped++; continue; }
    log(`  PUBLISH  ${label}  (ghl ${p.ghl_post_id})`);
    if (!live) { out.published.push({ label, goLive: p.goLive, at: null }); continue; }
    try {
      const [d] = await (await rest(`post_drafts?post_id=eq.${p.id}&select=assets`)).json();
      const imageUrl = (d && d.assets && d.assets.featured_image_url) || null;
      await publishBlogPost({ ghlPostId: p.ghl_post_id, pit, brand: p.blog, imageUrl, imageAltText: p.title || p.primary_keyword });
      // Conditional on still being 'scheduled', so if another run got there first this returns nothing.
      const body = { status: 'live', confirmed_live: true };
      if (!p.published_date) body.published_date = p.goLive;
      const r = await rest(`posts?id=eq.${p.id}&status=eq.scheduled`, { method: 'PATCH', headers: { ...h, Prefer: 'return=representation' }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(`patch ${p.id} failed: ${r.status} ${await r.text()}`);
      const changed = await r.json();
      out.published.push({ label, goLive: p.goLive, at: new Date().toISOString() });
      if (!changed.length) continue; // someone else already marked it live and did the follow-ups
      // Only ask Google to crawl once the page is really serving; otherwise the indexing
      // self-heal in status-sync verifies and requests it later.
      if (p.url) {
        try {
          if ((await verifyLive(p.url)) === 200) {
            await requestIndexing(p.url);
            await rest(`posts?id=eq.${p.id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ indexed: 'requested' }) });
          }
        } catch (e) { /* indexing is best-effort */ }
      }
      try { await syncInternalLinks({ rest, h, blog: p.blog, postId: p.id }); } catch (e) { /* best-effort */ }
    } catch (e) {
      console.error(`  FAIL publish ${label}: ${e.message}`);
      out.failed.push({ label, error: e.message });
    }
  }
  return out;
}
