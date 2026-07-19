// STEP A+A2 combined, for EDITORIAL fixes on an ALREADY-LIVE post. POST { post_id, instruction }
// -> read the post's ACTUAL published HTML from GHL, apply the instruction (built from the
// editorial-review issues the user selected) via Claude, and save a body_proposals row
// (kind:'editorial', phase:'proposed'). Reuses the same publish/swap steps (temp post +
// manual delete + slug swap) as the keyword-coverage and internal-links flows — the Draft
// tab's "Ask Claude to revise" only rewrites the Supabase draft copy, which never reaches an
// already-published page (GHL locks body content after publish).
import { getBlogPostDetail, getBlogPostBySlug } from './_lib/ghl.mjs';
import { refineBodySection, bodyLossCheck } from './_lib/optimize.mjs';

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
  const { post_id, instruction } = body;
  if (!post_id || !instruction) return json(400, { error: 'post_id and instruction required' });

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

    const rev = await refineBodySection({ brand, title: detail.title, currentBody: rawHTML, instruction, anthropicKey: AKEY });
    const warn = bodyLossCheck(rawHTML, rev.body_html);

    await rest(`body_proposals?post_id=eq.${post_id}&phase=neq.temp_published`, { method: 'DELETE', headers: { ...h, Prefer: 'return=minimal' } });
    await rest('body_proposals', { method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({
      post_id, blog: brand, ghl_post_id: ghlId, real_slug: realSlug, kind: 'editorial',
      covered: [], missing: [], added_html: '', new_html: rev.body_html,
      summary: rev.summary || 'Applied the selected editorial fixes.',
      note: warn || null, phase: 'proposed',
    }) });
    return json(200, { ok: true });
  } catch (e) { return json(500, { error: String(e && e.message || e) }); }
};
