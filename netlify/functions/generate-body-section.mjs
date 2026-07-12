// POST { post_id, keywords:[{query,...}] } -> generate the additive section for the
// SELECTED keywords and build the full new body. Background fn; updates the body_proposals
// row (phase 'analysed' -> 'proposed'). The dashboard polls for phase 'proposed'.
import { getBlogPostDetail } from './_lib/ghl.mjs';
import { improveBodyWoven, bodyLossCheck } from './_lib/optimize.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpprrknnkjyluhgtoezu.supabase.co';
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AKEY = process.env.ANTHROPIC_API_KEY;
const PIT = process.env.GHL_API_TOKEN;
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  if (!SKEY || !AKEY || !PIT) return json(500, { error: 'Server not configured.' });
  let body; try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'invalid JSON' }); }
  const { post_id, keywords } = body;
  if (!post_id || !Array.isArray(keywords) || !keywords.length) return json(400, { error: 'post_id and non-empty keywords required' });

  const h = { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'content-type': 'application/json' };
  const rest = (q, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: h, ...opts });

  try {
    const [post] = await (await rest(`posts?id=eq.${post_id}&select=blog`)).json();
    const [prop] = await (await rest(`body_proposals?post_id=eq.${post_id}&phase=in.(analysed,proposed)&order=created_at.desc&limit=1`)).json();
    if (!post || !prop) return json(404, { error: 'no analysed proposal for this post' });
    const brand = post.blog;

    const detail = await getBlogPostDetail({ ghlPostId: prop.ghl_post_id, pit: PIT });
    const gen = await improveBodyWoven({ brand, title: detail.title, currentHtml: detail.rawHTML, missing: keywords, anthropicKey: AKEY });
    const new_html = gen.body_html || detail.rawHTML || '';
    const warn = bodyLossCheck(detail.rawHTML, new_html);
    const summary = gen.summary || 'Wove in coverage for the selected keywords.';

    await rest(`body_proposals?id=eq.${prop.id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({
      added_html: '', new_html, summary, note: warn || null,
      phase: 'proposed', updated_at: new Date().toISOString(),
    }) });
    return json(200, { ok: true });
  } catch (e) { return json(500, { error: String(e && e.message || e) }); }
};
