// POST { post_id, date } -> creates the post in ESC Hub as a DRAFT (body is final
// at create time), records ghl_post_id + scheduled_date + status='scheduled'.
// The daily cron publishes it live on the date (next build). Blocks if the draft
// has hard-fail check issues, or if it was already sent.
import { createBlogPost } from './_lib/ghl.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpprrknnkjyluhgtoezu.supabase.co';
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PIT = process.env.GHL_API_TOKEN;
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  if (!SKEY || !PIT) return json(500, { error: 'Server not configured (missing SUPABASE_SERVICE_ROLE_KEY or GHL_API_TOKEN).' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'invalid JSON' }); }
  const { post_id, date } = body;
  if (!post_id) return json(400, { error: 'post_id required' });

  const h = { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'content-type': 'application/json' };
  const rest = (q, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: h, ...opts });

  try {
    const [post] = await (await rest(`posts?id=eq.${post_id}&select=*`)).json();
    if (!post) return json(404, { error: 'post not found' });
    if (post.ghl_post_id) return json(409, { error: 'already sent to ESC Hub' });
    const [draft] = await (await rest(`post_drafts?post_id=eq.${post_id}&select=*`)).json();
    if (!draft) return json(400, { error: 'no draft to schedule yet' });
    if (draft.check_report && draft.check_report.verdict === 'fail') return json(400, { error: 'draft has must-fix issues' });

    const r = await createBlogPost({ brand: post.blog, post, draft, pit: PIT, status: 'DRAFT' });

    const patch = { ghl_post_id: r.id, url: r.url, status: 'scheduled', current_step: Math.max(post.current_step || 0, 5) };
    if (date) patch.scheduled_date = date;
    await rest(`posts?id=eq.${post_id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify(patch) });

    return json(200, { ok: true, ghl_post_id: r.id, url: r.url, date: date || null });
  } catch (e) {
    return json(500, { error: String(e && e.message || e) });
  }
};
