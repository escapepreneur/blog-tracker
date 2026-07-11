// STEP C. POST { post_id } -> after Sienna has DELETED the old post in GHL, move the
// improved (temp) post onto the real URL. Verifies the old slug is actually free first,
// renames via PUT, verifies it landed, updates the tracker, re-requests indexing, logs it.
// Refuses (leaves everything intact) if the old post still exists or the rename doesn't take.
import { getBlogPostDetail, getBlogPostBySlug, updateBlogPost } from './_lib/ghl.mjs';
import { BRANDS } from './_lib/brands.mjs';
import { requestIndexing } from './_lib/google.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpprrknnkjyluhgtoezu.supabase.co';
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PIT = process.env.GHL_API_TOKEN;
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
const ymd = (d) => d.toISOString().slice(0, 10);

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  if (!SKEY || !PIT) return json(500, { error: 'Server not configured.' });
  let body; try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'invalid JSON' }); }
  const { post_id } = body;
  if (!post_id) return json(400, { error: 'post_id required' });

  const h = { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'content-type': 'application/json' };
  const rest = (q, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: h, ...opts });

  try {
    const [post] = await (await rest(`posts?id=eq.${post_id}&select=*`)).json();
    const [prop] = await (await rest(`body_proposals?post_id=eq.${post_id}&phase=eq.temp_published&order=created_at.desc&limit=1`)).json();
    if (!post || !prop) return json(404, { error: 'no temp version to swap' });
    const brand = post.blog;

    // 1. the old post must be gone (a real delete frees the slug; archive does NOT)
    const stillThere = await getBlogPostBySlug({ brand, slug: prop.real_slug, pit: PIT });
    if (stillThere && (stillThere._id || stillThere.id) !== prop.temp_ghl_post_id) {
      return json(409, { error: `The old post at /${prop.real_slug} still exists. Delete it in GHL (not archive), then try again.` });
    }

    // 2. rename the temp post onto the real slug
    const cur = await getBlogPostDetail({ ghlPostId: prop.temp_ghl_post_id, pit: PIT });
    await updateBlogPost({ ghlPostId: prop.temp_ghl_post_id, brand, pit: PIT, current: cur, urlSlug: prop.real_slug });

    // 3. verify it actually took the real slug (not a suffix)
    const after = await getBlogPostDetail({ ghlPostId: prop.temp_ghl_post_id, pit: PIT });
    if (after.urlSlug !== prop.real_slug) {
      // keep it retryable (still temp_published) — just record what happened
      await rest(`body_proposals?id=eq.${prop.id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ temp_slug: after.urlSlug, note: `Rename landed on "${after.urlSlug}", not "${prop.real_slug}".`, updated_at: new Date().toISOString() }) });
      return json(409, { error: `Rename landed on "${after.urlSlug}", not "${prop.real_slug}" — the old post may not be fully deleted. The improved version is live at /${after.urlSlug}; delete the old post, then Finish swap again.` });
    }

    // 4. the new post is now the live one at the real URL
    const realUrl = post.url;
    await rest(`posts?id=eq.${post_id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ ghl_post_id: prop.temp_ghl_post_id, indexed: 'requested' }) });
    if (realUrl) { try { await requestIndexing(realUrl); } catch (e) { /* best-effort */ } }
    await rest('optimizations', { method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({
      post_id, blog: brand, opt_date: ymd(new Date()), kind: 'content', note: prop.summary || 'Added a section for missing keywords', baseline: null,
    }) });
    await rest(`body_proposals?id=eq.${prop.id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ phase: 'done', updated_at: new Date().toISOString() }) });

    return json(200, { ok: true, url: realUrl });
  } catch (e) { return json(500, { error: String(e && e.message || e) }); }
};
