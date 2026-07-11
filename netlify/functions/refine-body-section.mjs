// POST { post_id, instruction, added_html } -> revise the additive section per a
// plain-English instruction. Background fn; updates body_proposals.added_html (+ updated_at).
// The dashboard polls updated_at.
import { refineBodySection } from './_lib/optimize.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpprrknnkjyluhgtoezu.supabase.co';
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AKEY = process.env.ANTHROPIC_API_KEY;
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  if (!SKEY || !AKEY) return json(500, { error: 'Server not configured.' });
  let body; try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'invalid JSON' }); }
  const { post_id, instruction, added_html } = body;
  if (!post_id || !instruction || !added_html) return json(400, { error: 'post_id, instruction and added_html required' });

  const h = { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'content-type': 'application/json' };
  const rest = (q, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: h, ...opts });

  try {
    const [post] = await (await rest(`posts?id=eq.${post_id}&select=blog,title,primary_keyword`)).json();
    const [prop] = await (await rest(`body_proposals?post_id=eq.${post_id}&phase=eq.proposed&order=created_at.desc&limit=1`)).json();
    if (!post || !prop) return json(404, { error: 'no proposed section for this post' });
    const rev = await refineBodySection({ brand: post.blog, title: post.title || post.primary_keyword, currentSection: added_html, instruction, anthropicKey: AKEY });
    await rest(`body_proposals?id=eq.${prop.id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({
      added_html: rev.added_html || added_html, summary: rev.summary || prop.summary, updated_at: new Date().toISOString(),
    }) });
    return json(200, { ok: true });
  } catch (e) { return json(500, { error: String(e && e.message || e) }); }
};
