// TEMPORARY: validate GHL accepts a Pinterest-native boardId in pinterestPostDetails.
// Creates a far-future SCHEDULED pin (never goes public), inspects what GHL stored, deletes it.
const GHL = 'https://services.leadconnectorhq.com';
const PIT = process.env.GHL_API_TOKEN;
const LOC = process.env.GHL_LOCATION_ID || 'EoD3KT6IiKx0oIXjInOt';
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
const H = { Authorization: `Bearer ${PIT}`, Version: '2021-07-28', 'Content-Type': 'application/json', Accept: 'application/json' };
const ESC_ACCT = '69e7ae9ef460db52ae19f6fc_EoD3KT6IiKx0oIXjInOt_1109785670584800857_profile';
const ESC_BLOG_BOARD = '1109785601867074947';
const IMG = 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&w=1000';

export const handler = async () => {
  if (!PIT) return json(200, { note: 'no PIT' });
  // userId from an existing post
  const lr = await fetch(`${GHL}/social-media-posting/${LOC}/posts/list`, { method: 'POST', headers: H, body: JSON.stringify({}) });
  const ld = await lr.json().catch(() => ({}));
  const posts = ld.posts || (ld.results && ld.results.posts) || [];
  const userId = posts.map(p => p.createdBy).find(Boolean);
  if (!userId) return json(200, { error: 'no userId found' });

  const payload = {
    accountIds: [ESC_ACCT], type: 'post', status: 'scheduled',
    scheduleDate: '2027-12-31T09:00:00.000Z', userId,
    summary: 'TEST validation pin — will be deleted',
    media: [{ url: IMG }],
    pinterestPostDetails: { boardId: ESC_BLOG_BOARD, link: 'https://eschub.com/blog', title: 'Test' },
  };
  const cr = await fetch(`${GHL}/social-media-posting/${LOC}/posts`, { method: 'POST', headers: H, body: JSON.stringify(payload) });
  const ct = await cr.text();
  let created = {}; try { created = JSON.parse(ct); } catch {}
  const post = (created.results && created.results.post) || created.post || created;
  const id = post._id || post.id || post.postId;
  const result = { create_http: cr.status, stored_platform: post.platform, stored_ppd: post.pinterestPostDetails, stored_status: post.status, raw: ct.slice(0, 300) };
  // delete it
  if (id) { try { const dr = await fetch(`${GHL}/social-media-posting/${LOC}/posts/${id}`, { method: 'DELETE', headers: H }); result.deleted_http = dr.status; } catch (e) { result.delete_err = String(e); } }
  return json(200, result);
};
