// TEMPORARY: final attempt to find/delete leftover TEST drafts via status filters. Removed after.
const GHL = 'https://services.leadconnectorhq.com';
const PIT = process.env.GHL_API_TOKEN;
const LOC = process.env.GHL_LOCATION_ID || 'EoD3KT6IiKx0oIXjInOt';
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
const H = { Authorization: `Bearer ${PIT}`, Version: '2021-07-28', 'Content-Type': 'application/json', Accept: 'application/json' };

export const handler = async () => {
  if (!PIT) return json(200, { note: 'no PIT' });
  const seen = new Map();
  for (const body of [{}, { status: 'draft' }, { statuses: ['draft'] }, { type: 'draft' }, { postType: 'draft' }]) {
    try {
      const r = await fetch(`${GHL}/social-media-posting/${LOC}/posts/list`, { method: 'POST', headers: H, body: JSON.stringify(body) });
      if (!r.ok) continue;
      const d = await r.json().catch(() => ({}));
      const posts = d.posts || (d.results && d.results.posts) || [];
      posts.forEach(p => { if ((p.summary || '').includes('TEST — ignore')) seen.set(p._id || p.id || p.postId, p.status); });
    } catch {}
  }
  const deleted = [];
  for (const id of seen.keys()) {
    try { const r = await fetch(`${GHL}/social-media-posting/${LOC}/posts/${id}`, { method: 'DELETE', headers: H }); deleted.push({ id, http: r.status }); } catch (e) { deleted.push({ id, error: String(e) }); }
  }
  return json(200, { found: seen.size, deleted });
};
