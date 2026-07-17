// POST { post_id, date, publish? } -> creates the post in GHL (body is final at
// create time). publish:true -> create as PUBLISHED (live now) + tracker status='live'.
// Otherwise create as DRAFT + status='scheduled'; the daily cron publishes it live on
// the date. Blocks if the draft has hard-fail check issues, or if it was already sent.
import { createBlogPost } from './_lib/ghl.mjs';
import { requestIndexing } from './_lib/google.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpprrknnkjyluhgtoezu.supabase.co';
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PIT = process.env.GHL_API_TOKEN;
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  if (!SKEY || !PIT) return json(500, { error: 'Server not configured (missing SUPABASE_SERVICE_ROLE_KEY or GHL_API_TOKEN).' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'invalid JSON' }); }
  const { post_id, date, publish, override } = body;
  if (!post_id) return json(400, { error: 'post_id required' });
  const today = new Date().toISOString().slice(0, 10);
  // A scheduled post goes live on its date, so reject a past date — but "publish now"
  // goes live today regardless of any date, so the guard only applies to scheduling.
  if (!publish && date && date < today) {
    return json(400, { error: `Scheduled date ${date} is in the past — pick today or a future date.` });
  }

  const h = { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'content-type': 'application/json' };
  const rest = (q, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: h, ...opts });

  try {
    const [post] = await (await rest(`posts?id=eq.${post_id}&select=*`)).json();
    if (!post) return json(404, { error: 'post not found' });
    if (post.ghl_post_id) return json(409, { error: 'already sent to ESC Hub' });
    const [draft] = await (await rest(`post_drafts?post_id=eq.${post_id}&select=*`)).json();
    if (!draft) return json(400, { error: 'no draft to schedule yet' });
    if (!override && draft.check_report && draft.check_report.verdict === 'fail') return json(400, { error: 'draft has must-fix issues' });

    const r = await createBlogPost({
      brand: post.blog, post, draft, pit: PIT, status: publish ? 'PUBLISHED' : 'DRAFT',
      imageUrl: draft.assets && draft.assets.featured_image_url,
      imageAltText: (draft.assets && draft.assets.title) || post.primary_keyword,
    });

    const patch = { ghl_post_id: r.id, url: r.url, current_step: Math.max(post.current_step || 0, 5) };
    // keep the tracker title in sync with what we publish (the draft's H1)
    const draftTitle = draft.assets && draft.assets.title;
    if (draftTitle && !(post.title && post.title.trim())) patch.title = draftTitle;
    if (publish) {
      patch.status = 'live'; patch.published_date = today; patch.confirmed_live = true; patch.scheduled_date = date || today;
      patch.indexed = 'requested';
    } else {
      patch.status = 'scheduled'; if (date) patch.scheduled_date = date;
    }
    await rest(`posts?id=eq.${post_id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify(patch) });

    // On go-live, ask Google to crawl it (best-effort; no-op if GOOGLE_SA_KEY unset).
    // Verify the page is actually serving first — GHL can take a moment to propagate a
    // brand-new post, and asking Google to crawl too early gets a 404 that then sits
    // stale for a long time before Google bothers rechecking. If it's not up yet, skip
    // silently — the daily status-sync self-heal will request it once it verifies 200.
    if (publish && r.url) {
      try {
        const live = await fetch(r.url, { method: 'GET', redirect: 'follow' }).then(res => res.status === 200).catch(() => false);
        if (live) await requestIndexing(r.url);
      } catch (e) { /* indexing is best-effort */ }
    }

    return json(200, { ok: true, ghl_post_id: r.id, url: r.url, published: !!publish, date: date || (publish ? today : null) });
  } catch (e) {
    return json(500, { error: String(e && e.message || e) });
  }
};
