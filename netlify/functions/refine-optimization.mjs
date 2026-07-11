// POST { post_id, instruction, title, meta } -> revise the current title+meta per a
// plain-English instruction. Returns the revised pair; also saves it to the proposal.
// Sync (fast model).
import { refineTitleMeta } from './_lib/optimize.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpprrknnkjyluhgtoezu.supabase.co';
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AKEY = process.env.ANTHROPIC_API_KEY;
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  if (!SKEY || !AKEY) return json(500, { error: 'Server not configured.' });
  let body; try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'invalid JSON' }); }
  const { post_id, instruction, title, meta } = body;
  if (!post_id || !instruction || !title) return json(400, { error: 'post_id, instruction and title required' });

  const h = { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'content-type': 'application/json' };
  const rest = (q, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: h, ...opts });

  try {
    const [post] = await (await rest(`posts?id=eq.${post_id}&select=blog`)).json();
    if (!post) return json(404, { error: 'post not found' });
    const [prop] = await (await rest(`optimization_proposals?post_id=eq.${post_id}&status=eq.proposed&order=created_at.desc&limit=1`)).json();
    const rev = await refineTitleMeta({ brand: post.blog, currentTitle: title, currentMeta: meta, instruction, keywords: (prop && prop.keywords) || [], anthropicKey: AKEY });
    if (prop) await rest(`optimization_proposals?id=eq.${prop.id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ after_title: rev.title, after_meta: rev.meta_description }) });
    return json(200, { ok: true, title: rev.title, meta_description: rev.meta_description });
  } catch (e) { return json(500, { error: String(e && e.message || e) }); }
};
