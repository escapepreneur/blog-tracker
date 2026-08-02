// TEMPORARY, one-off repair tool — delete after use.
// POST { post_id, date } (date = YYYY-MM-DD, the CORRECT publish day) -> forces GHL's
// publishedAt back to that day at noon UTC, using the same minimal {status, imageUrl,
// imageAltText, publishedAt} PUT as updatePostImage (does not touch body/title/slug).
// Repairs posts whose publishedAt got stuck at whenever their featured image first
// rendered (usually right after drafting) instead of their real go-live date — root
// cause fixed 2026-08-01 in publishBlogPost/updatePostImage (_lib/ghl.mjs).
import { updatePostImage } from './_lib/ghl.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpprrknnkjyluhgtoezu.supabase.co';
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PIT = process.env.GHL_API_TOKEN;
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  if (!SKEY || !PIT) return json(500, { error: 'Server not configured.' });
  let body; try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'invalid JSON' }); }
  const { post_id, date } = body;
  if (!post_id || !date) return json(400, { error: 'post_id and date required' });

  const h = { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'content-type': 'application/json' };
  const rest = (q, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: h, ...opts });

  try {
    const [post] = await (await rest(`posts?id=eq.${post_id}&select=blog,ghl_post_id,status`)).json();
    if (!post) return json(404, { error: 'post not found' });
    if (!post.ghl_post_id) return json(400, { error: 'post has no ghl_post_id' });
    const [draft] = await (await rest(`post_drafts?post_id=eq.${post_id}&select=assets`)).json();
    const a = (draft && draft.assets) || {};
    if (!a.featured_image_url) return json(400, { error: 'no featured_image_url on this draft — cannot resend the minimal PUT' });

    await updatePostImage({
      ghlPostId: post.ghl_post_id, pit: PIT, brand: post.blog,
      status: post.status === 'live' ? 'PUBLISHED' : 'DRAFT',
      imageUrl: a.featured_image_url, imageAltText: a.featured_title || '',
      publishedAt: `${date}T12:00:00.000Z`,
    });
    return json(200, { ok: true, post_id, forced_publishedAt: `${date}T12:00:00.000Z` });
  } catch (e) { return json(500, { error: String(e && e.message || e) }); }
};
