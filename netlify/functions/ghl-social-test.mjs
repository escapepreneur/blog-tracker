// TEMPORARY: discover the valid pinterestPostDetails board field by sending many candidate
// keys at once and reading which the validator rejects ("should not exist"). Removed after.
const GHL = 'https://services.leadconnectorhq.com';
const PIT = process.env.GHL_API_TOKEN;
const LOC = process.env.GHL_LOCATION_ID || 'EoD3KT6IiKx0oIXjInOt';
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
const H = { Authorization: `Bearer ${PIT}`, Version: '2021-07-28', 'Content-Type': 'application/json', Accept: 'application/json' };
const ESC_ACCT = '69e7ae9ef460db52ae19f6fc_EoD3KT6IiKx0oIXjInOt_1109785670584800857_profile';

export const handler = async () => {
  if (!PIT) return json(200, { note: 'no PIT' });
  const lr = await fetch(`${GHL}/social-media-posting/${LOC}/posts/list`, { method: 'POST', headers: H, body: JSON.stringify({}) });
  const ld = await lr.json().catch(() => ({}));
  const posts = ld.posts || (ld.results && ld.results.posts) || [];
  const userId = posts.map(p => p.createdBy).find(Boolean);

  const candidates = { link: 'x', title: 'x', boardId: 'x', board: 'x', boardName: 'x', boards: 'x', boardIds: 'x', boardID: 'x', pinBoardId: 'x', pinterestBoardId: 'x', board_id: 'x', pinId: 'x', sectionId: 'x' };
  const payload = { accountIds: [ESC_ACCT], type: 'post', status: 'scheduled', scheduleDate: '2027-12-31T09:00:00.000Z', userId, summary: 'probe', media: [], pinterestPostDetails: candidates };
  const r = await fetch(`${GHL}/social-media-posting/${LOC}/posts`, { method: 'POST', headers: H, body: JSON.stringify(payload) });
  const t = await r.text();
  let j = {}; try { j = JSON.parse(t); } catch {}
  const msgs = Array.isArray(j.message) ? j.message : [j.message].filter(Boolean);
  const rejected = msgs.filter(m => /should not exist/.test(m)).map(m => m.replace(/.*property (\S+).*/, '$1'));
  const surviving = Object.keys(candidates).filter(k => !rejected.includes('pinterestPostDetails.' + k) && !rejected.includes(k));
  // clean up if it somehow created a draft
  const id = (j.results && j.results.post && (j.results.post._id || j.results.post.id));
  if (id) { try { await fetch(`${GHL}/social-media-posting/${LOC}/posts/${id}`, { method: 'DELETE', headers: H }); } catch {} }
  return json(200, { http: r.status, rejected, surviving_pinterest_fields: surviving, all_messages: msgs });
};
