// TEMPORARY: confirm pinterestPostDetails.boardIds shape + media shape. Removed after.
const GHL = 'https://services.leadconnectorhq.com';
const PIT = process.env.GHL_API_TOKEN;
const LOC = process.env.GHL_LOCATION_ID || 'EoD3KT6IiKx0oIXjInOt';
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
const H = { Authorization: `Bearer ${PIT}`, Version: '2021-07-28', 'Content-Type': 'application/json', Accept: 'application/json' };
const ESC_ACCT = '69e7ae9ef460db52ae19f6fc_EoD3KT6IiKx0oIXjInOt_1109785670584800857_profile';
const ESC_BLOG_BOARD = '1109785601867074947'; // "ESC Hub - Blog" (Pinterest-native id, via Blotato)
const IMG = 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&w=1000';

export const handler = async () => {
  if (!PIT) return json(200, { note: 'no PIT' });
  const lr = await fetch(`${GHL}/social-media-posting/${LOC}/posts/list`, { method: 'POST', headers: H, body: JSON.stringify({}) });
  const ld = await lr.json().catch(() => ({}));
  const posts = ld.posts || (ld.results && ld.results.posts) || [];
  const userId = posts.map(p => p.createdBy).find(Boolean);
  const sampleMedia = (posts.find(p => Array.isArray(p.media) && p.media.length) || {}).media;

  // try the documented-ish shapes: boardIds as {accountId: boardId}, media with url+type
  const attempts = [];
  const tryOne = async (label, media, ppd) => {
    const payload = { accountIds: [ESC_ACCT], type: 'post', status: 'scheduled', scheduleDate: '2027-12-31T09:00:00.000Z', userId, summary: 'probe pin', media, pinterestPostDetails: ppd };
    const r = await fetch(`${GHL}/social-media-posting/${LOC}/posts`, { method: 'POST', headers: H, body: JSON.stringify(payload) });
    const t = await r.text(); let j = {}; try { j = JSON.parse(t); } catch {}
    const post = j.results && j.results.post;
    const id = post && (post._id || post.id);
    if (id) { try { await fetch(`${GHL}/social-media-posting/${LOC}/posts/${id}`, { method: 'DELETE', headers: H }); } catch {} }
    attempts.push({ label, http: r.status, ok: r.ok, stored_ppd: post && post.pinterestPostDetails, stored_media: post && post.media, msg: r.ok ? 'CREATED' : (Array.isArray(j.message) ? j.message : [j.message]).join(' | ').slice(0, 300) });
  };

  await tryOne('boardIds-map + media{url,type:image/jpeg}', [{ url: IMG, type: 'image/jpeg' }], { boardIds: { [ESC_ACCT]: ESC_BLOG_BOARD }, link: 'https://eschub.com/blog', title: 'Test' });
  await tryOne('boardIds-map + media{url} only', [{ url: IMG }], { boardIds: { [ESC_ACCT]: ESC_BLOG_BOARD }, link: 'https://eschub.com/blog', title: 'Test' });

  return json(200, { sample_media_shape: sampleMedia, attempts });
};
