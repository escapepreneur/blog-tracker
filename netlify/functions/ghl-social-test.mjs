// TEMPORARY: delete the leftover TEST draft posts I created while probing. Removed after.
const GHL = 'https://services.leadconnectorhq.com';
const PIT = process.env.GHL_API_TOKEN;
const LOC = process.env.GHL_LOCATION_ID || 'EoD3KT6IiKx0oIXjInOt';
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
const H = { Authorization: `Bearer ${PIT}`, Version: '2021-07-28', 'Content-Type': 'application/json', Accept: 'application/json' };

export const handler = async () => {
  if (!PIT) return json(200, { note: 'no PIT' });
  const lr = await fetch(`${GHL}/social-media-posting/${LOC}/posts/list`, { method: 'POST', headers: H, body: JSON.stringify({}) });
  const ld = await lr.json().catch(() => ({}));
  const posts = ld.posts || (ld.results && ld.results.posts) || [];
  const mine = posts.filter(p => (p.summary || '').includes('TEST — ignore'));
  const deleted = [];
  for (const p of mine) {
    const id = p._id || p.id || p.postId;
    try { const r = await fetch(`${GHL}/social-media-posting/${LOC}/posts/${id}`, { method: 'DELETE', headers: H }); deleted.push({ id, http: r.status }); }
    catch (e) { deleted.push({ id, error: String(e && e.message || e) }); }
  }
  return json(200, { found: mine.length, deleted });
};
