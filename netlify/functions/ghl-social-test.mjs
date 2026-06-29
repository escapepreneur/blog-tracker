// TEMPORARY: get the posts/list shape right, then read a real post for board field + userId. Removed after.
const GHL = 'https://services.leadconnectorhq.com';
const PIT = process.env.GHL_API_TOKEN;
const LOC = process.env.GHL_LOCATION_ID || 'EoD3KT6IiKx0oIXjInOt';
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
const H = { Authorization: `Bearer ${PIT}`, Version: '2021-07-28', 'Content-Type': 'application/json', Accept: 'application/json' };

export const handler = async () => {
  if (!PIT) return json(200, { note: 'no PIT' });
  const variants = [
    {},
    { limit: 20, skip: 0 },
    { type: 'recent', limit: 20, skip: 0 },
    { postType: 'all', limit: 20, skip: 0 },
  ];
  const out = [];
  for (const body of variants) {
    try {
      const r = await fetch(`${GHL}/social-media-posting/${LOC}/posts/list`, { method: 'POST', headers: H, body: JSON.stringify(body) });
      const t = await r.text();
      if (r.ok) {
        let d = {}; try { d = JSON.parse(t); } catch {}
        const posts = d.posts || (d.results && d.results.posts) || [];
        const pin = posts.find(p => JSON.stringify(p).toLowerCase().includes('board') || JSON.stringify(p).toLowerCase().includes('pinterest'));
        out.push({ body, http: r.status, total: posts.length, userIds: [...new Set(posts.map(p => p.userId).filter(Boolean))].slice(0, 2), keys: posts[0] ? Object.keys(posts[0]) : [], pin: pin ? JSON.stringify(pin).slice(0, 900) : (posts[0] ? JSON.stringify(posts[0]).slice(0, 700) : null) });
        break; // got a working shape
      } else {
        out.push({ body, http: r.status, err: t.slice(0, 200) });
      }
    } catch (e) { out.push({ body, error: String(e && e.message || e) }); }
  }
  return json(200, out);
};
