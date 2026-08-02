// TEMPORARY, one-off repair tool — delete after use.
// POST { post_id, date } (date = YYYY-MM-DD, the CORRECT publish day) -> forces GHL's
// publishedAt back to that day at noon UTC, using the same minimal {status, imageUrl,
// imageAltText, publishedAt} PUT as updatePostImage (does not touch body/title/slug).
// Repairs posts whose publishedAt got stuck at whenever their featured image first
// rendered (usually right after drafting) instead of their real go-live date — root
// cause fixed 2026-08-01 in publishBlogPost/updatePostImage (_lib/ghl.mjs).
import { updatePostImage, getBlogPostBySlug, getBlogPostDetail } from './_lib/ghl.mjs';

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
    const [post] = await (await rest(`posts?id=eq.${post_id}&select=blog,url,ghl_post_id,status`)).json();
    if (!post) return json(404, { error: 'post not found' });

    let ghlId = post.ghl_post_id;
    if (!ghlId) {
      const slug = (post.url || '').split('/post/')[1]?.replace(/[?#].*$/, '').replace(/\/+$/, '');
      if (!slug) return json(400, { error: 'no ghl_post_id and no url to look one up by' });
      const f = await getBlogPostBySlug({ brand: post.blog, slug, pit: PIT });
      if (!f) return json(404, { error: 'could not find this post in GHL by slug either' });
      ghlId = f._id || f.id;
    }

    const [draft] = await (await rest(`post_drafts?post_id=eq.${post_id}&select=assets`)).json();
    const a = (draft && draft.assets) || {};
    let imageUrl = a.featured_image_url;
    let imageAltText = a.featured_title || '';
    if (!imageUrl) {
      const detail = await getBlogPostDetail({ ghlPostId: ghlId, pit: PIT });
      imageUrl = detail.imageUrl; imageAltText = detail.imageAltText || '';
    }
    if (!imageUrl) return json(400, { error: 'no image found on the draft or the live GHL post' });

    await updatePostImage({
      ghlPostId: ghlId, pit: PIT, brand: post.blog,
      status: post.status === 'live' ? 'PUBLISHED' : 'DRAFT',
      imageUrl, imageAltText,
      publishedAt: `${date}T12:00:00.000Z`,
    });
    return json(200, { ok: true, post_id, forced_publishedAt: `${date}T12:00:00.000Z` });
  } catch (e) { return json(500, { error: String(e && e.message || e) }); }
};
