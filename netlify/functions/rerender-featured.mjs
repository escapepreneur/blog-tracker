// POST { post_id, featured_title?, featured_tagline?, swap?, featured_bg_url? }
// Updates the featured image's title/tagline, sets the exact chosen background if
// featured_bg_url is given (from the candidate picker), else bumps the auto-pick index
// if swap, clears the rendered image, then triggers the GitHub Actions render.
// The dashboard polls post_drafts.assets.featured_image_url for the new image.
// env: SUPABASE_SERVICE_ROLE_KEY, GITHUB_DISPATCH_TOKEN (Actions-scoped PAT).
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
  const { post_id, featured_title, featured_tagline, swap, featured_bg_url } = body;
  if (!post_id) return json(400, { error: 'post_id required' });

  const h = { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'content-type': 'application/json' };
  const rest = (q, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: h, ...opts });

  try {
    const [draft] = await (await rest(`post_drafts?post_id=eq.${post_id}&select=assets`)).json();
    if (!draft) return json(404, { error: 'draft not found' });
    const a = draft.assets || {};
    if (typeof featured_title === 'string' && featured_title.trim()) a.featured_title = featured_title.trim();
    if (typeof featured_tagline === 'string') a.featured_tagline = featured_tagline.trim();
    if (featured_bg_url) {
      a.featured_bg_url = featured_bg_url; // explicit pick from the candidate grid — worker uses this directly
    } else {
      if (!a.featured_image_search) return json(400, { error: 'no featured image search term on this draft' });
      if (swap) a.featured_bg_index = (a.featured_bg_index || 0) + 1;
    }
    delete a.featured_image_url; // mark pending so the worker re-renders

    await rest(`post_drafts?post_id=eq.${post_id}`, {
      method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ assets: a }),
    });

    const r = await fetch(`https://api.github.com/repos/${REPO}/dispatches`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: 'application/vnd.github+json', 'content-type': 'application/json', 'User-Agent': 'blog-tracker' },
      body: JSON.stringify({ event_type: 'render-featured', client_payload: { post_id } }),
    });
    if (!r.ok) return json(502, { error: `GitHub dispatch ${r.status}: ${(await r.text()).slice(0, 200)}` });

    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: String(e && e.message || e) });
  }
};
