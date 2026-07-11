// STEP A (background). POST { post_id } -> read the live post + its ranking keywords,
// work out which keywords the body already covers vs is missing, and (if any missing)
// generate an ADDITIVE section to append. Saves a body_proposals row (phase 'proposed').
// Nothing is published. The dashboard polls body_proposals.
import { getBlogPostDetail, getBlogPostBySlug } from './_lib/ghl.mjs';
import { keywordCoverage } from './_lib/optimize.mjs';
import { BRANDS } from './_lib/brands.mjs';
import { searchAnalytics, getServiceAccount } from './_lib/google.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpprrknnkjyluhgtoezu.supabase.co';
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AKEY = process.env.ANTHROPIC_API_KEY;
const PIT = process.env.GHL_API_TOKEN;
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
const ymd = (d) => d.toISOString().slice(0, 10);
const slugFromUrl = (u) => String(u || '').split(/\/post\//)[1]?.replace(/[?#].*$/, '').replace(/\/+$/, '') || '';
const stripTags = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  if (!SKEY || !AKEY || !PIT) return json(500, { error: 'Server not configured.' });
  let body; try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'invalid JSON' }); }
  const { post_id } = body;
  if (!post_id) return json(400, { error: 'post_id required' });

  const h = { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'content-type': 'application/json' };
  const rest = (q, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: h, ...opts });

  try {
    const [post] = await (await rest(`posts?id=eq.${post_id}&select=*`)).json();
    if (!post) return json(404, { error: 'post not found' });
    if (!post.url) return json(400, { error: 'post has no URL' });
    const brand = post.blog;

    let ghlId = post.ghl_post_id;
    if (!ghlId) {
      const f = await getBlogPostBySlug({ brand, slug: slugFromUrl(post.url), pit: PIT });
      if (!f) return json(404, { error: 'could not find this post in GHL' });
      ghlId = f._id || f.id;
      await rest(`posts?id=eq.${post_id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ ghl_post_id: ghlId }) });
    }
    const detail = await getBlogPostDetail({ ghlPostId: ghlId, pit: PIT });
    const realSlug = detail.urlSlug || slugFromUrl(post.url);

    let keywords = [];
    if (getServiceAccount() && BRANDS[brand] && BRANDS[brand].gscProperty) {
      const now = new Date(); const end = new Date(now); end.setDate(end.getDate() - 3); const start = new Date(now); start.setDate(start.getDate() - 90);
      try {
        const rows = await searchAnalytics({ siteUrl: BRANDS[brand].gscProperty, startDate: ymd(start), endDate: ymd(end), dimensions: ['query'], rowLimit: 25, filters: [{ dimension: 'page', operator: 'equals', expression: post.url }] });
        keywords = (rows || []).map(r => ({ query: r.keys[0], position: r.position, impressions: r.impressions, ctr: r.ctr })).sort((a, b) => b.impressions - a.impressions);
      } catch (e) { /* best-effort */ }
    }
    const { covered, missing } = keywordCoverage(stripTags(detail.rawHTML), keywords);

    // Coverage only — no section generated yet. Sienna picks which missing keywords to
    // target, then the generate step writes the section for just those. (phase 'analysed')
    await rest(`body_proposals?post_id=eq.${post_id}&phase=neq.temp_published`, { method: 'DELETE', headers: { ...h, Prefer: 'return=minimal' } });
    await rest('body_proposals', { method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({
      post_id, blog: brand, ghl_post_id: ghlId, real_slug: realSlug,
      covered, missing, added_html: '', new_html: '', summary: '', phase: 'analysed',
    }) });
    return json(200, { ok: true, missing: missing.length });
  } catch (e) { return json(500, { error: String(e && e.message || e) }); }
};
