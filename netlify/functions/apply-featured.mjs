// POST { post_id } -> push the previewed featured image onto the LIVE GHL post in place
// (updatePostImage), then clear the featured_review flag. Used after the user approves
// the preview produced by refresh-featured. env: SUPABASE_SERVICE_ROLE_KEY, GHL_API_TOKEN.
import { updatePostImage } from './_lib/ghl.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpprrknnkjyluhgtoezu.supabase.co';
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PIT = process.env.GHL_API_TOKEN;
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  if (!SKEY || !PIT) return json(500, { error: 'Server not configured (SUPABASE/GHL).' });
  let body; try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'invalid JSON' }); }
  const { post_id } = body;
  if (!post_id) return json(400, { error: 'post_id required' });

  const h = { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'content-type': 'application/json' };
  const rest = (q, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: h, ...opts });

  try {
    const [post] = await (await rest(`posts?id=eq.${post_id}&select=blog,status,ghl_post_id,title,primary_keyword`)).json();
    if (!post) return json(404, { error: 'post not found' });
    if (!post.ghl_post_id) return json(400, { error: 'post is not in GHL yet' });
    const [draft] = await (await rest(`post_drafts?post_id=eq.${post_id}&select=assets`)).json();
    const a = (draft && draft.assets) || {};
    if (!a.featured_image_url) return json(400, { error: 'no rendered image to apply — render a preview first' });

    const status = post.status === 'live' ? 'PUBLISHED' : 'DRAFT';
    await updatePostImage({
      ghlPostId: post.ghl_post_id, pit: PIT, brand: post.blog, status,
      imageUrl: a.featured_image_url, imageAltText: a.featured_title || post.title || post.primary_keyword,
    });

    delete a.featured_review;
    await rest(`post_drafts?post_id=eq.${post_id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ assets: a }) });

    return json(200, { ok: true, imageUrl: a.featured_image_url });
  } catch (e) {
    return json(500, { error: String(e && e.message || e) });
  }
};
