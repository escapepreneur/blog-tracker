// TEMPORARY: extract a userId (createdBy) + read a real Pinterest post's pinterestPostDetails. Removed after.
const GHL = 'https://services.leadconnectorhq.com';
const PIT = process.env.GHL_API_TOKEN;
const LOC = process.env.GHL_LOCATION_ID || 'EoD3KT6IiKx0oIXjInOt';
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
const H = { Authorization: `Bearer ${PIT}`, Version: '2021-07-28', 'Content-Type': 'application/json', Accept: 'application/json' };

export const handler = async () => {
  if (!PIT) return json(200, { note: 'no PIT' });
  const r = await fetch(`${GHL}/social-media-posting/${LOC}/posts/list`, { method: 'POST', headers: H, body: JSON.stringify({ limit: 100, skip: 0 }) });
  const d = await r.json().catch(() => ({}));
  const posts = d.posts || (d.results && d.results.posts) || [];
  const byPlatform = {};
  posts.forEach(p => { byPlatform[p.platform] = (byPlatform[p.platform] || 0) + 1; });
  const createdByVals = [...new Set(posts.map(p => p.createdBy).filter(Boolean))].slice(0, 3);
  const pin = posts.find(p => p.platform === 'pinterest');
  return json(200, {
    total: posts.length,
    platforms: byPlatform,
    userId_candidates: createdByVals,
    pinterest_post: pin ? { summary: (pin.summary || '').slice(0, 60), media: pin.media, pinterestPostDetails: pin.pinterestPostDetails, accountIds: pin.accountIds } : 'none found in last 100',
  });
};
