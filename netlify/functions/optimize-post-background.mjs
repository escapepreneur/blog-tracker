// POST { post_id } -> build a title+meta optimisation PROPOSAL for a live post.
// Reads the live post (GHL detail incl. current title/meta/body) + the keywords it ranks
// for (Search Console) -> Claude rewrites title+meta for CTR -> saves a row to
// optimization_proposals (status 'proposed'). Nothing is published. Background fn: the
// dashboard polls optimization_proposals for the new proposal. Apply is a separate step.
import { getBlogPostDetail, getBlogPostBySlug } from './_lib/ghl.mjs';
import { optimizeTitleMeta } from './_lib/optimize.mjs';
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
  if (!SKEY || !AKEY || !PIT) return json(500, { error: 'Server not configured (SUPABASE/ANTHROPIC/GHL).' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'invalid JSON' }); }
  const { post_id } = body;
  if (!post_id) return json(400, { error: 'post_id required' });

  const h = { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'content-type': 'application/json' };
  const rest = (q, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: h, ...opts });

  try {
    const [post] = await (await rest(`posts?id=eq.${post_id}&select=*`)).json();
    if (!post) return json(404, { error: 'post not found' });
    if (!post.url) return json(400, { error: 'post has no URL — publish it first' });
    const brand = post.blog;

    // find the GHL post id (imported posts have none stored)
    let ghlId = post.ghl_post_id;
    if (!ghlId) {
      const found = await getBlogPostBySlug({ brand, slug: slugFromUrl(post.url), pit: PIT });
      if (!found) return json(404, { error: 'could not find this post in GHL by slug' });
      ghlId = found._id || found.id;
      await rest(`posts?id=eq.${post_id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ ghl_post_id: ghlId }) });
    }

    const detail = await getBlogPostDetail({ ghlPostId: ghlId, pit: PIT });
    const articleText = stripTags(detail.rawHTML);

    // keywords this page ranks for (Search Console), highest impressions first
    let keywords = [];
    if (getServiceAccount() && BRANDS[brand] && BRANDS[brand].gscProperty) {
      const now = new Date();
      const end = new Date(now); end.setDate(end.getDate() - 3);
      const start = new Date(now); start.setDate(start.getDate() - 90);
      try {
        const rows = await searchAnalytics({
          siteUrl: BRANDS[brand].gscProperty, startDate: ymd(start), endDate: ymd(end),
          dimensions: ['query'], rowLimit: 25,
          filters: [{ dimension: 'page', operator: 'equals', expression: post.url }],
        });
        keywords = (rows || []).map(r => ({ query: r.keys[0], position: r.position, impressions: r.impressions, ctr: r.ctr }))
          .sort((a, b) => b.impressions - a.impressions);
      } catch (e) { /* GSC best-effort */ }
    }

    const opt = await optimizeTitleMeta({
      brand, currentTitle: detail.title, currentMeta: detail.description,
      articleText, keywords, anthropicKey: AKEY,
    });

    // one live proposal per post — clear old proposed rows, insert the fresh one
    await rest(`optimization_proposals?post_id=eq.${post_id}&status=eq.proposed`, { method: 'DELETE', headers: { ...h, Prefer: 'return=minimal' } });
    await rest('optimization_proposals', { method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({
      post_id, blog: brand, ghl_post_id: ghlId,
      before_title: detail.title, before_meta: detail.description,
      after_title: opt.title, after_meta: opt.meta_description,
      keywords, rationale: opt.rationale, status: 'proposed',
    }) });

    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: String(e && e.message || e) });
  }
};
