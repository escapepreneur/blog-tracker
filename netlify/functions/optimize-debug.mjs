// TEMP diagnostic: run the fast steps of the optimise pipeline for ?post_id= and report
// where it fails. Skips the Claude call (10s sync limit). Delete after use.
import { getBlogPostDetail, getBlogPostBySlug } from './_lib/ghl.mjs';
import { BRANDS } from './_lib/brands.mjs';
import { searchAnalytics, getServiceAccount } from './_lib/google.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpprrknnkjyluhgtoezu.supabase.co';
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PIT = process.env.GHL_API_TOKEN;
const j = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o, null, 2) });
const ymd = (d) => d.toISOString().slice(0, 10);
const slugFromUrl = (u) => String(u || '').split(/\/post\//)[1]?.replace(/[?#].*$/, '').replace(/\/+$/, '') || '';

export const handler = async (event) => {
  const out = { env: { SKEY: !!SKEY, PIT: !!PIT, ANTHROPIC: !!process.env.ANTHROPIC_API_KEY, GOOGLE_SA: !!getServiceAccount() } };
  try {
    const post_id = (event.queryStringParameters || {}).post_id;
    const h = { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'content-type': 'application/json' };
    const [post] = await (await fetch(`${SUPABASE_URL}/rest/v1/posts?id=eq.${post_id}&select=*`, { headers: h })).json();
    out.post = post ? { blog: post.blog, url: post.url, ghl_post_id: post.ghl_post_id } : null;
    if (!post) return j(200, out);
    const brand = post.blog; const slug = slugFromUrl(post.url); out.slug = slug;
    try {
      let ghlId = post.ghl_post_id;
      if (!ghlId) { const f = await getBlogPostBySlug({ brand, slug, pit: PIT }); out.bySlug = f ? { id: f._id || f.id, urlSlug: f.urlSlug, status: f.status } : 'NOT FOUND'; ghlId = f && (f._id || f.id); }
      out.ghlId = ghlId;
      if (ghlId) { const d = await getBlogPostDetail({ ghlPostId: ghlId, pit: PIT }); out.detail = { title: d.title, hasBody: !!d.rawHTML, descLen: (d.description || '').length }; }
    } catch (e) { out.readError = String(e && e.message || e); }
    try {
      if (getServiceAccount() && BRANDS[brand] && BRANDS[brand].gscProperty) {
        const now = new Date(); const end = new Date(now); end.setDate(end.getDate() - 3); const start = new Date(now); start.setDate(start.getDate() - 90);
        const rows = await searchAnalytics({ siteUrl: BRANDS[brand].gscProperty, startDate: ymd(start), endDate: ymd(end), dimensions: ['query'], rowLimit: 25, filters: [{ dimension: 'page', operator: 'equals', expression: post.url }] });
        out.gscKeywords = (rows || []).length;
      } else out.gscKeywords = 'SA/property not configured';
    } catch (e) { out.gscError = String(e && e.message || e); }
    return j(200, out);
  } catch (e) { return j(500, { ...out, fatal: String(e && e.message || e) }); }
};
