// TEMPORARY: read existing GHL posts to reverse-engineer the Pinterest board field + a valid userId. Removed after.
const GHL = 'https://services.leadconnectorhq.com';
const PIT = process.env.GHL_API_TOKEN;
const LOC = process.env.GHL_LOCATION_ID || 'EoD3KT6IiKx0oIXjInOt';
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
const H = { Authorization: `Bearer ${PIT}`, Version: '2021-07-28', 'Content-Type': 'application/json', Accept: 'application/json' };

export const handler = async () => {
  if (!PIT) return json(200, { note: 'no PIT' });
  // GHL posts list is a POST with filters
  const bodies = [
    { label: 'all', body: { type: 'all', accounts: [], skip: 0, limit: 30, fromDate: '2024-01-01', toDate: '2027-01-01' } },
  ];
  const out = [];
  for (const { label, body } of bodies) {
    try {
      const r = await fetch(`${GHL}/social-media-posting/${LOC}/posts/list`, { method: 'POST', headers: H, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      const posts = (d.posts || (d.results && d.results.posts) || []);
      // find a pinterest post if any; else show the first post's keys
      const pin = posts.find(p => (p.accountIds || []).some(a => String(a).includes('_profile')) || JSON.stringify(p).toLowerCase().includes('pinterest') || JSON.stringify(p).toLowerCase().includes('board'));
      out.push({
        label, http: r.status, total: posts.length,
        sample_keys: posts[0] ? Object.keys(posts[0]) : [],
        userIds: [...new Set(posts.map(p => p.userId).filter(Boolean))].slice(0, 3),
        pin_sample: pin ? JSON.stringify(pin).slice(0, 1200) : null,
      });
    } catch (e) { out.push({ label, error: String(e && e.message || e) }); }
  }
  return json(200, out);
};
