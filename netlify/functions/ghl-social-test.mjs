// TEMPORARY: get a userId (createdBy) then probe pinterestPostDetails sub-schema via validation. Removed after.
const GHL = 'https://services.leadconnectorhq.com';
const PIT = process.env.GHL_API_TOKEN;
const LOC = process.env.GHL_LOCATION_ID || 'EoD3KT6IiKx0oIXjInOt';
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
const H = { Authorization: `Bearer ${PIT}`, Version: '2021-07-28', 'Content-Type': 'application/json', Accept: 'application/json' };
const ACCT = '69e7ae9ef460db52ae19f6fc_EoD3KT6IiKx0oIXjInOt_1109785670584800857_profile';
const IMG = 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&w=1000';

export const handler = async () => {
  if (!PIT) return json(200, { note: 'no PIT' });
  // 1. working list shape {} -> userId from createdBy
  const lr = await fetch(`${GHL}/social-media-posting/${LOC}/posts/list`, { method: 'POST', headers: H, body: JSON.stringify({}) });
  const ld = await lr.json().catch(() => ({}));
  const posts = ld.posts || (ld.results && ld.results.posts) || [];
  const userId = (posts.map(p => p.createdBy).find(Boolean)) || null;
  const pin = posts.find(p => p.platform === 'pinterest');

  // 2. probe pinterestPostDetails with a fake board -> read validation to learn sub-fields
  const probes = [];
  if (userId) {
    const base = { accountIds: [ACCT], type: 'post', status: 'draft', userId, summary: 'TEST — ignore', media: [{ url: IMG }] };
    for (const [label, extra] of [
      ['ppd.boardId', { pinterestPostDetails: { boardId: 'ZZ' } }],
      ['ppd.board+link', { pinterestPostDetails: { board: 'ZZ', link: 'https://eschub.com/blog', title: 'T' } }],
      ['no-board', {}],
    ]) {
      try {
        const r = await fetch(`${GHL}/social-media-posting/${LOC}/posts`, { method: 'POST', headers: H, body: JSON.stringify({ ...base, ...extra }) });
        const t = await r.text();
        let id = null; try { const j = JSON.parse(t); id = (j.post && (j.post._id || j.post.id)) || j._id || j.id; } catch {}
        if (id) { try { await fetch(`${GHL}/social-media-posting/${LOC}/posts/${id}`, { method: 'DELETE', headers: H }); } catch {} }
        probes.push({ label, http: r.status, created: !!id, body: t.slice(0, 280) });
      } catch (e) { probes.push({ label, error: String(e && e.message || e) }); }
    }
  }
  return json(200, { userId_found: !!userId, pinterest_history: pin ? pin.pinterestPostDetails : 'none', probes });
};
