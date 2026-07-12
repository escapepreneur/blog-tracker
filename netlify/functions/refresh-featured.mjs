// POST { post_id, featured_title, featured_tagline, featured_image_search }
// Seed/merge the featured-image fields onto the post's post_drafts row (creating the
// row if the post has none — e.g. older posts published outside the pipeline), clear
// the rendered image, and trigger the GitHub Actions render. The worker renders the
// branded graphic AND pushes it onto the live GHL post in place (updatePostImage).
// The dashboard polls post_drafts.assets.featured_image_url for the new image.
// env: SUPABASE_SERVICE_ROLE_KEY, GITHUB_DISPATCH_TOKEN.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpprrknnkjyluhgtoezu.supabase.co';
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GH_TOKEN = process.env.GITHUB_DISPATCH_TOKEN;
const REPO = process.env.GITHUB_REPO || 'escapepreneur/blog-tracker';
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  if (!SKEY) return json(500, { error: 'Server not configured (SUPABASE_SERVICE_ROLE_KEY).' });
  if (!GH_TOKEN) return json(500, { error: 'Server not configured (GITHUB_DISPATCH_TOKEN).' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'invalid JSON' }); }
  const { post_id, featured_title, featured_tagline, featured_image_search, swap } = body;
  if (!post_id) return json(400, { error: 'post_id required' });
  if (!featured_title || !String(featured_title).trim()) return json(400, { error: 'featured_title required' });
  if (!featured_image_search || !String(featured_image_search).trim()) return json(400, { error: 'featured_image_search required' });

  const h = { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'content-type': 'application/json' };
  const rest = (q, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: h, ...opts });

  try {
    const [post] = await (await rest(`posts?id=eq.${post_id}&select=blog`)).json();
    if (!post) return json(404, { error: 'post not found' });
    const [draft] = await (await rest(`post_drafts?post_id=eq.${post_id}&select=assets`)).json();

    const a = (draft && draft.assets) || {};
    a.featured_title = String(featured_title).trim();
    a.featured_tagline = typeof featured_tagline === 'string' ? featured_tagline.trim() : (a.featured_tagline || '');
    a.featured_image_search = String(featured_image_search).trim();
    a.featured_bg_index = swap ? ((a.featured_bg_index || 0) + 1) : 0;
    a.featured_review = true;      // preview only — worker renders but does NOT push to the live post
    delete a.featured_image_url;   // mark pending so the worker renders it
    delete a.pin_image_url;        // let the pin re-render to match too

    const w = draft
      ? await rest(`post_drafts?post_id=eq.${post_id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ assets: a }) })
      : await rest('post_drafts', { method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ post_id, assets: a }) });
    if (!w.ok) return json(500, { error: `could not save featured fields: ${w.status} ${(await w.text()).slice(0, 160)}` });

    const r = await fetch(`https://api.github.com/repos/${REPO}/dispatches`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: 'application/vnd.github+json', 'content-type': 'application/json', 'User-Agent': 'blog-tracker' },
      body: JSON.stringify({ event_type: 'render-featured', client_payload: { post_id } }),
    });
    if (!r.ok) return json(502, { error: `GitHub dispatch ${r.status}: ${(await r.text()).slice(0, 200)}` });

    return json(202, { ok: true });
  } catch (e) {
    return json(500, { error: String(e && e.message || e) });
  }
};
