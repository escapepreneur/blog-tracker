// POST { post_id, title, meta } -> quick Claude review of a (possibly edited) title+meta
// for the post's proposal. Returns { verdict, notes }. Sync (fast model, small output).
import { reviewTitleMeta } from './_lib/optimize.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpprrknnkjyluhgtoezu.supabase.co';
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AKEY = process.env.ANTHROPIC_API_KEY;
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  if (!SKEY || !AKEY) return json(500, { error: 'Server not configured.' });
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'invalid JSON' }); }
  const { post_id, title, meta } = body;
  if (!post_id || !title) return json(400, { error: 'post_id and title required' });

  const h = { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'content-type': 'application/json' };
  const rest = (q, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: h, ...opts });

  try {
    const [post] = await (await rest(`posts?id=eq.${post_id}&select=blog`)).json();
    if (!post) return json(404, { error: 'post not found' });
    const [prop] = await (await rest(`optimization_proposals?post_id=eq.${post_id}&status=eq.proposed&order=created_at.desc&limit=1&select=keywords`)).json();
    const review = await reviewTitleMeta({ brand: post.blog, title, meta, keywords: (prop && prop.keywords) || [], anthropicKey: AKEY });
    // normalise notes to an array of strings (the model occasionally returns a single string/object)
    const rawNotes = review && review.notes;
    const notes = Array.isArray(rawNotes) ? rawNotes.map(n => typeof n === 'string' ? n : JSON.stringify(n))
      : (rawNotes ? [typeof rawNotes === 'string' ? rawNotes : JSON.stringify(rawNotes)] : []);
    return json(200, { ok: true, verdict: (review && review.verdict) || 'ok', notes });
  } catch (e) {
    return json(500, { error: String(e && e.message || e) });
  }
};
