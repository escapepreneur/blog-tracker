// TEMPORARY: attempt a DRAFT Pinterest post via the PIT to learn the exact requirements
// (userId? board? field names?). Creates a draft, captures the response, then deletes it. Removed after.
const GHL = 'https://services.leadconnectorhq.com';
const PIT = process.env.GHL_API_TOKEN;
const LOC = process.env.GHL_LOCATION_ID || 'EoD3KT6IiKx0oIXjInOt';
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
const H = { Authorization: `Bearer ${PIT}`, Version: '2021-07-28', 'Content-Type': 'application/json', Accept: 'application/json' };
const ACCT = '69e7ae9ef460db52ae19f6fc_EoD3KT6IiKx0oIXjInOt_1109785670584800857_profile'; // ESC Hub pinterest
const IMG = 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&w=1000';

async function tryCreate(label, payload) {
  try {
    const r = await fetch(`${GHL}/social-media-posting/${LOC}/posts`, { method: 'POST', headers: H, body: JSON.stringify(payload) });
    const t = await r.text();
    let id = null; try { const j = JSON.parse(t); id = (j.post && (j.post._id || j.post.id)) || j._id || j.id || (j.results && j.results._id); } catch {}
    // clean up if it created something
    if (id) { try { await fetch(`${GHL}/social-media-posting/${LOC}/posts/${id}`, { method: 'DELETE', headers: H }); } catch {} }
    return { label, http: r.status, created_id: id, body: t.slice(0, 400) };
  } catch (e) { return { label, error: String(e && e.message || e) }; }
}

export const handler = async () => {
  if (!PIT) return json(200, { note: 'no PIT' });
  const base = { accountIds: [ACCT], type: 'post', status: 'draft', summary: 'TEST pin — ignore', media: [{ url: IMG }] };
  const out = [];
  out.push(await tryCreate('no-userId', { ...base }));
  out.push(await tryCreate('with-pinterest-opts', { ...base, pinterestOptions: { boardId: '', link: 'https://eschub.com/blog' } }));
  return json(200, { probes: out });
};
