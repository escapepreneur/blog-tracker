// STEP B. POST { post_id } -> publish the improved body as a NEW post at a TEMP slug
// (so it's live and reviewable) carrying over the current title/meta/image/category/author.
// The old post stays live untouched. Saves temp_ghl_post_id/temp_slug, phase 'temp_published'.
import { getBlogPostDetail, createPostRaw, publicUrl } from './_lib/ghl.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpprrknnkjyluhgtoezu.supabase.co';
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PIT = process.env.GHL_API_TOKEN;
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  if (!SKEY || !PIT) return json(500, { error: 'Server not configured.' });
  let body; try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'invalid JSON' }); }
  const { post_id } = body;
  if (!post_id) return json(400, { error: 'post_id required' });

  const h = { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'content-type': 'application/json' };
  const rest = (q, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: h, ...opts });

  try {
    const [post] = await (await rest(`posts?id=eq.${post_id}&select=blog`)).json();
    const [prop] = await (await rest(`body_proposals?post_id=eq.${post_id}&phase=eq.proposed&order=created_at.desc&limit=1`)).json();
    if (!post || !prop) return json(404, { error: 'no proposal to publish' });
    if (prop.temp_ghl_post_id) return json(409, { error: 'a temp version already exists for this post' });
    const brand = post.blog;

    // carry over the current post's metadata (fresh)
    const cur = await getBlogPostDetail({ ghlPostId: prop.ghl_post_id, pit: PIT });
    const tempSlug = `${prop.real_slug}-v2-${Math.random().toString(36).slice(2, 6)}`;
    const created = await createPostRaw({
      brand, pit: PIT, title: cur.title, rawHTML: prop.new_html, description: cur.description,
      urlSlug: tempSlug, imageUrl: cur.imageUrl, imageAltText: cur.imageAltText,
      categories: cur.categories, author: cur.author, status: 'PUBLISHED', publishedAt: cur.publishedAt,
    });

    await rest(`body_proposals?id=eq.${prop.id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({
      temp_ghl_post_id: created.id, temp_slug: created.urlSlug, phase: 'temp_published', updated_at: new Date().toISOString(),
    }) });
    return json(200, { ok: true, temp_url: publicUrl(brand, created.urlSlug), real_slug: prop.real_slug });
  } catch (e) { return json(500, { error: String(e && e.message || e) }); }
};
