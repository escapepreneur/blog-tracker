// STEP A+A2 combined, for internal LINKS. POST { post_id } -> read the live post, work
// out which of its tracked internal_links targets are actually missing from the published
// body (GHL's PUT ignores rawHTML, so a link added via the dashboard's manual "Add link"
// UI after a post already went live has no way to reach the live page), and if any are
// missing, weave real working links for them into the live HTML. Saves a body_proposals
// row (kind:'links', phase:'proposed' or 'done'). Reuses the same publish/swap steps
// (improve-body-publish / improve-body-swap) as the keyword-coverage flow.
import { getBlogPostDetail, getBlogPostBySlug } from './_lib/ghl.mjs';
import { insertMissingLinks, bodyLossCheck } from './_lib/optimize.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpprrknnkjyluhgtoezu.supabase.co';
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AKEY = process.env.ANTHROPIC_API_KEY;
const PIT = process.env.GHL_API_TOKEN;
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
const slugFromUrl = (u) => String(u || '').split(/\/post\//)[1]?.replace(/[?#].*$/, '').replace(/\/+$/, '') || '';

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
      if (!f) return json(404, { error: 'could not find this post in GHL (may have been deleted or renamed there)' });
      ghlId = f._id || f.id;
      await rest(`posts?id=eq.${post_id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ ghl_post_id: ghlId }) });
    }
    const detail = await getBlogPostDetail({ ghlPostId: ghlId, pit: PIT });
    const realSlug = detail.urlSlug || slugFromUrl(post.url);
    const rawHTML = detail.rawHTML || '';

    // What SHOULD be linked (the tracking table) vs what's ACTUALLY on the live page.
    const tracked = await (await rest(`internal_links?from_post_id=eq.${post_id}&to_post_id=not.is.null&select=to_post_id`)).json();
    const toIds = [...new Set((tracked || []).map(t => t.to_post_id))];
    await rest(`body_proposals?post_id=eq.${post_id}&phase=neq.temp_published`, { method: 'DELETE', headers: { ...h, Prefer: 'return=minimal' } });
    if (!toIds.length) {
      await rest('body_proposals', { method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({
        post_id, blog: brand, ghl_post_id: ghlId, real_slug: realSlug, kind: 'links',
        covered: [], missing: [], added_html: '', new_html: '', summary: 'No internal links are tracked for this post yet.', phase: 'done',
      }) });
      return json(200, { ok: true, missing: 0 });
    }
    const targets = await (await rest(`posts?id=in.(${toIds.join(',')})&select=id,url,title,primary_keyword`)).json();
    const hrefs = new Set([...rawHTML.matchAll(/href="([^"]*)"/g)].map(m => m[1].replace(/^http:/, 'https:')));
    const missing = (targets || []).filter(t => t.url && !hrefs.has(t.url.replace(/^http:/, 'https:')))
      .map(t => ({ url: t.url, title: t.title || t.primary_keyword || '' }));

    if (!missing.length) {
      await rest('body_proposals', { method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({
        post_id, blog: brand, ghl_post_id: ghlId, real_slug: realSlug, kind: 'links',
        covered: [], missing: [], added_html: '', new_html: '', summary: 'All tracked internal links are already live on the page.', phase: 'done',
      }) });
      return json(200, { ok: true, missing: 0 });
    }

    const gen = await insertMissingLinks({ brand, title: detail.title, currentHtml: rawHTML, missingLinks: missing, anthropicKey: AKEY });
    const warn = bodyLossCheck(rawHTML, gen.body_html);
    await rest('body_proposals', { method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({
      post_id, blog: brand, ghl_post_id: ghlId, real_slug: realSlug, kind: 'links',
      covered: [], missing, added_html: '', new_html: gen.body_html,
      summary: gen.summary || `Added ${missing.length} missing internal link(s).`,
      note: warn || null, phase: 'proposed',
    }) });
    return json(200, { ok: true, missing: missing.length });
  } catch (e) { return json(500, { error: String(e && e.message || e) }); }
};
