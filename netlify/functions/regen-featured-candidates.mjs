// POST { post_id, term? } -> search Pexels for featured-image background candidates and
// store them on post_drafts.assets.featured_bg_candidates for the dashboard to show as a
// picker grid. Same term -> next page (fresh results, not the same handful each time);
// a new term -> page 1. Mirrors regen-image.mjs's pattern for body images.
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
  const { post_id } = body;
  const newTerm = (body.term && String(body.term).trim()) || null;
  if (!post_id) return json(400, { error: 'post_id required' });

  const h = { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'content-type': 'application/json' };
  const rest = (q, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: h, ...opts });

  try {
    const [draft] = await (await rest(`post_drafts?post_id=eq.${post_id}&select=assets`)).json();
    if (!draft) return json(404, { error: 'draft not found' });
    const assets = draft.assets || {};
    const useTerm = newTerm || assets.featured_image_search;
    if (!useTerm) return json(400, { error: 'no search term — enter one first' });

    // new term -> start fresh; same term -> advance the page so we get genuinely different photos
    const page = (newTerm && newTerm !== assets.featured_image_search) ? 1 : (((assets.featured_bg_page || 1) % 15) + 1);
    const cands = await searchPexels(useTerm, PEXELS, 6, page);

    assets.featured_image_search = useTerm;
    assets.featured_bg_page = page;
    if (cands.length) assets.featured_bg_candidates = cands;
    await rest(`post_drafts?post_id=eq.${post_id}`, {
      method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ assets }),
    });
    return json(200, { ok: true, candidates: assets.featured_bg_candidates || [], term: useTerm, page });
  } catch (e) {
    return json(500, { error: String(e && e.message || e) });
  }
};
