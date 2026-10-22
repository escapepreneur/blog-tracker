// POST { post_id, content_type, data } with header "Authorization: Bearer <Blog Studio session token>"
//   data = the photo as base64 (the browser shrinks it first). Saves it to the ESC Hub media
//   library and returns its public address: { ok, url }. The caller decides whether it becomes the
//   featured background or a body image.
// Only a signed-in Blog Studio user may upload, so the media library can't be filled by strangers.
import { uploadMedia } from './_lib/ghl.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpprrknnkjyluhgtoezu.supabase.co';
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PIT = process.env.GHL_API_TOKEN;
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });

const MAX_BYTES = 4 * 1024 * 1024; // Netlify caps a request body at about 6 MB, and base64 adds a third
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

// Trust the file's own first bytes, not the label the browser put on it.
function sniff(b) {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  if (!SKEY || !PIT) return json(500, { error: 'Server not configured (missing SUPABASE_SERVICE_ROLE_KEY or GHL_API_TOKEN).' });

  const token = String((event.headers && (event.headers.authorization || event.headers.Authorization)) || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return json(401, { error: 'Please sign in to Blog Studio again.' });
  const who = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SKEY, Authorization: `Bearer ${token}` } }).catch(() => null);
  if (!who || !who.ok) return json(401, { error: 'Your sign-in has expired. Refresh the page and sign in again.' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'invalid JSON' }); }
  const { post_id, data } = body;
  if (!/^[0-9a-f-]{36}$/i.test(String(post_id || ''))) return json(400, { error: 'post_id required' });
  if (!data || typeof data !== 'string') return json(400, { error: 'no image data' });

  const h = { apikey: SKEY, Authorization: `Bearer ${SKEY}` };
  try {
    const [post] = await (await fetch(`${SUPABASE_URL}/rest/v1/posts?id=eq.${post_id}&select=id`, { headers: h })).json();
    if (!post) return json(404, { error: 'post not found' });

    const buffer = Buffer.from(data, 'base64');
    if (!buffer.length) return json(400, { error: 'empty image' });
    if (buffer.length > MAX_BYTES) return json(413, { error: 'That image is too large. Try a smaller one.' });
    const type = sniff(buffer);
    if (!type) return json(415, { error: 'That file is not a JPG, PNG or WebP image.' });

    const up = await uploadMedia({ buffer, filename: `upload-${post_id}-${Date.now()}.${EXT[type]}`, contentType: type, pit: PIT });
    if (!up.url) return json(500, { error: 'ESC Hub did not return an address for the image.' });
    return json(200, { ok: true, url: up.url, bytes: buffer.length });
  } catch (e) {
    return json(500, { error: String(e && e.message || e) });
  }
};
