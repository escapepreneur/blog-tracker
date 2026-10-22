// POST { post_id, action: 'create' | 'off' } with "Authorization: Bearer <Blog Studio session token>"
//   create -> returns the draft's share link (making one if it has none yet); the same link is
//             returned every time, and it always shows the latest saved draft.
//   off    -> turns the link off; the old address stops working. A new 'create' makes a new one.
// The preview page itself is /preview/<token> (see preview.mjs). Only a signed-in user can run this.
import { randomBytes } from 'node:crypto';
import { requireUser } from './_lib/auth.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpprrknnkjyluhgtoezu.supabase.co';
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  if (!SKEY) return json(500, { error: 'Server not configured (SUPABASE_SERVICE_ROLE_KEY).' });
  const denied = await requireUser(event);
  if (denied) return json(denied.status, { error: denied.error });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'invalid JSON' }); }
  const { post_id, action } = body;
  if (!/^[0-9a-f-]{36}$/i.test(String(post_id || ''))) return json(400, { error: 'post_id required' });
  if (!['create', 'off'].includes(action)) return json(400, { error: 'action must be create or off' });

  const h = { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'content-type': 'application/json' };
  const rest = (q, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: h, ...opts });

  try {
    const [post] = await (await rest(`posts?id=eq.${post_id}&select=id,status,url`)).json();
    if (!post) return json(404, { error: 'post not found' });
    const [draft] = await (await rest(`post_drafts?post_id=eq.${post_id}&select=post_id,share_token`)).json();
    if (!draft) return json(400, { error: 'There is no draft to share yet. Generate the draft first.' });

    if (action === 'off') {
      const r = await rest(`post_drafts?post_id=eq.${post_id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ share_token: null }) });
      if (!r.ok) return json(500, { error: `could not turn the link off: ${r.status}` });
      return json(200, { ok: true, off: true });
    }

    // Once a post is live the public page is the thing to share; any old link already redirects there.
    if (post.status === 'live' && !draft.share_token) return json(200, { ok: true, url: post.url, live: true });

    let token = draft.share_token;
    if (!token) {
      token = randomBytes(32).toString('base64url'); // 43 characters, unguessable
      const r = await rest(`post_drafts?post_id=eq.${post_id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ share_token: token }) });
      if (!r.ok) return json(500, { error: `could not create the link: ${r.status}` });
    }
    const host = (event.headers && (event.headers['x-forwarded-host'] || event.headers.host)) || '';
    const origin = host ? `https://${host}` : (process.env.URL || 'https://blog.escapepreneur.com');
    return json(200, { ok: true, url: `${origin}/preview/${token}` });
  } catch (e) {
    return json(500, { error: String(e && e.message || e) });
  }
};
