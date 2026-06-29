// TEMPORARY: find the correct pinterestPostDetails board field name + media shape.
const GHL = 'https://services.leadconnectorhq.com';
const PIT = process.env.GHL_API_TOKEN;
const LOC = process.env.GHL_LOCATION_ID || 'EoD3KT6IiKx0oIXjInOt';
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
const H = { Authorization: `Bearer ${PIT}`, Version: '2021-07-28', 'Content-Type': 'application/json', Accept: 'application/json' };
const ESC_ACCT = '69e7ae9ef460db52ae19f6fc_EoD3KT6IiKx0oIXjInOt_1109785670584800857_profile';
const BOARD = '1109785601867074947';
const IMG = 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&w=1000';

export const handler = async () => {
  if (!PIT) return json(200, { note: 'no PIT' });
  const lr = await fetch(`${GHL}/social-media-posting/${LOC}/posts/list`, { method: 'POST', headers: H, body: JSON.stringify({}) });
  const ld = await lr.json().catch(() => ({}));
  const posts = ld.posts || (ld.results && ld.results.posts) || [];
  const userId = posts.map(p => p.createdBy).find(Boolean);

  const variants = {
    board: { board: BOARD, link: 'https://eschub.com/blog', title: 'Test' },
    boardName: { boardName: BOARD, link: 'https://eschub.com/blog', title: 'Test' },
    board_id: { board_id: BOARD, link: 'https://eschub.com/blog', title: 'Test' },
    pinBoardId: { pinBoardId: BOARD, link: 'https://eschub.com/blog', title: 'Test' },
    empty: { link: 'https://eschub.com/blog', title: 'Test' },
  };
  const out = [];
  for (const [name, ppd] of Object.entries(variants)) {
    const payload = { accountIds: [ESC_ACCT], type: 'post', status: 'scheduled', scheduleDate: '2027-12-31T09:00:00.000Z', userId, summary: 'TEST — delete', media: [{ url: IMG, type: 'image' }], pinterestPostDetails: ppd };
    try {
      const r = await fetch(`${GHL}/social-media-posting/${LOC}/posts`, { method: 'POST', headers: H, body: JSON.stringify(payload) });
      const t = await r.text(); let j = {}; try { j = JSON.parse(t); } catch {}
      const post = (j.results && j.results.post) || j.post || {};
      const id = post._id || post.id || post.postId;
      if (id) { try { await fetch(`${GHL}/social-media-posting/${LOC}/posts/${id}`, { method: 'DELETE', headers: H }); } catch {} }
      out.push({ name, http: r.status, platform: post.platform, ppd_stored: post.pinterestPostDetails, msg: r.ok ? 'OK' : (j.message || t).toString().slice(0, 200) });
    } catch (e) { out.push({ name, error: String(e && e.message || e) }); }
  }
  return json(200, out);
};
