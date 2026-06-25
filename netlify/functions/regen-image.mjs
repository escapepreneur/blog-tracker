// POST { post_id, index, term? } -> re-search Pexels for ONE body-image slot and
// replace its candidate photos. Same term -> next page (fresh results); a new term
// -> page 1. Fast/sync (Pexels responds in <2s). The dashboard re-renders just that slot.
import { searchPexels } from './_lib/pexels.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpprrknnkjyluhgtoezu.supabase.co';
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PEXELS = process.env.PEXELS_API_KEY;
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  if (!SKEY || !PEXELS) return json(500, { error: 'Server not configured (missing SUPABASE_SERVICE_ROLE_KEY or PEXELS_API_KEY).' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'invalid JSON' }); }
  const { post_id, index } = body;
  const newTerm = (body.term && String(body.term).trim()) || null;
  if (!post_id || index == null) return json(400, { error: 'post_id and index required' });

  const h = { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'content-type': 'application/json' };
  const rest = (q, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: h, ...opts });

  try {
    const [draft] = await (await rest(`post_drafts?post_id=eq.${post_id}&select=assets`)).json();
    if (!draft) return json(404, { error: 'draft not found' });
    const assets = draft.assets || {};
    const slots = assets.body_images || [];
    const slot = slots[index];
    if (!slot) return json(400, { error: 'no such image slot' });

    const useTerm = newTerm || slot.term;
    // new term -> start fresh; same term -> advance the page so we get different photos
    const page = (newTerm && newTerm !== slot.term) ? 1 : (((slot.page || 1) % 15) + 1);
    const cands = await searchPexels(useTerm, PEXELS, 4, page);

    slot.term = useTerm;
    slot.page = page;
    if (cands.length) {
      slot.candidates = cands;
      if (slot.chosen && !cands.some(c => c.url === slot.chosen)) slot.chosen = null;
    }
    await rest(`post_drafts?post_id=eq.${post_id}`, {
      method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ assets }),
    });
    return json(200, { ok: true, candidates: slot.candidates || [], term: useTerm, page });
  } catch (e) {
    return json(500, { error: String(e && e.message || e) });
  }
};
