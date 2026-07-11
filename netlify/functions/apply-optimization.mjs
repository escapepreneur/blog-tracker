// POST { post_id } -> apply the current title+meta proposal to the LIVE GHL post in place,
// then log it to the optimizations table (with a GSC baseline) and re-request indexing.
// Sync fn (one PUT + a couple of writes; well under the timeout).
import { getBlogPostDetail, updateBlogPost } from './_lib/ghl.mjs';
import { BRANDS } from './_lib/brands.mjs';
import { requestIndexing, searchAnalytics, getServiceAccount } from './_lib/google.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpprrknnkjyluhgtoezu.supabase.co';
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PIT = process.env.GHL_API_TOKEN;
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
const ymd = (d) => d.toISOString().slice(0, 10);

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  if (!SKEY || !PIT) return json(500, { error: 'Server not configured (SUPABASE/GHL).' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'invalid JSON' }); }
  const { post_id } = body;
  if (!post_id) return json(400, { error: 'post_id required' });

  const h = { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'content-type': 'application/json' };
  const rest = (q, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: h, ...opts });

  try {
    const [post] = await (await rest(`posts?id=eq.${post_id}&select=*`)).json();
    const [prop] = await (await rest(`optimization_proposals?post_id=eq.${post_id}&status=eq.proposed&order=created_at.desc&limit=1`)).json();
    if (!post || !prop) return json(404, { error: 'no proposal to apply' });
    const brand = post.blog;
    const ghlId = prop.ghl_post_id;
    if (!ghlId) return json(400, { error: 'proposal has no GHL post id' });

    // fresh current object (full-object PUT so nothing gets wiped), then update title+meta
    const current = await getBlogPostDetail({ ghlPostId: ghlId, pit: PIT });
    await updateBlogPost({ ghlPostId: ghlId, brand, pit: PIT, current, title: prop.after_title, description: prop.after_meta });

    // keep the tracker title in sync
    await rest(`posts?id=eq.${post_id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ title: prop.after_title }) });

    // capture a "before" baseline for the optimization log (best-effort)
    let baseline = null;
    if (getServiceAccount() && BRANDS[brand] && BRANDS[brand].gscProperty && post.url) {
      const now = new Date(); const end = new Date(now); end.setDate(end.getDate() - 3);
      const start = new Date(now); start.setDate(start.getDate() - 90);
      try {
        const [pg] = await searchAnalytics({
          siteUrl: BRANDS[brand].gscProperty, startDate: ymd(start), endDate: ymd(end),
          dimensions: ['page'], rowLimit: 1, filters: [{ dimension: 'page', operator: 'equals', expression: post.url }],
        });
        if (pg) baseline = { position: pg.position, impressions: pg.impressions, clicks: pg.clicks, ctr: pg.ctr, window: '90d', captured: ymd(new Date()) };
      } catch (e) { /* best-effort */ }
    }

    await rest('optimizations', { method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({
      post_id, blog: brand, opt_date: ymd(new Date()), kind: 'title-meta',
      note: `Title/meta optimised → "${prop.after_title}"`, baseline,
    }) });

    // re-request indexing so Google re-crawls the new title/meta
    if (post.url) { try { await requestIndexing(post.url); } catch (e) { /* best-effort */ } }

    await rest(`optimization_proposals?id=eq.${prop.id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'applied', applied_at: new Date().toISOString() }) });

    return json(200, { ok: true, title: prop.after_title });
  } catch (e) {
    return json(500, { error: String(e && e.message || e) });
  }
};
