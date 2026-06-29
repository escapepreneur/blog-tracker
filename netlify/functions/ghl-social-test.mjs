// TEMPORARY: discover GHL Pinterest boards endpoint (oauth-style paths) + a usable userId. Removed after.
const GHL = 'https://services.leadconnectorhq.com';
const PIT = process.env.GHL_API_TOKEN;
const LOC = process.env.GHL_LOCATION_ID || 'EoD3KT6IiKx0oIXjInOt';
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
const H = { Authorization: `Bearer ${PIT}`, Version: '2021-07-28', Accept: 'application/json' };

const FULL = '69e7ae9ef460db52ae19f6fc_EoD3KT6IiKx0oIXjInOt_1109785670584800857_profile'; // ESC Hub pinterest acct id
const OAUTH = '69e7ae9ef460db52ae19f6fc';

export const handler = async () => {
  if (!PIT) return json(200, { ok: false, note: 'no PIT' });
  const probe = async (path) => {
    try { const r = await fetch(GHL + path, { headers: H }); const t = await r.text(); return { path, http: r.status, body: t.slice(0, 300) }; }
    catch (e) { return { path, error: String(e && e.message || e) }; }
  };
  const board_probes = [];
  for (const p of [
    `/social-media-posting/oauth/${LOC}/pinterest/accounts/${FULL}/boards`,
    `/social-media-posting/oauth/${LOC}/pinterest/accounts/${OAUTH}/boards`,
    `/social-media-posting/oauth/${LOC}/pinterest/accounts/${FULL}`,
    `/social-media-posting/oauth/${LOC}/pinterest/accounts/${OAUTH}`,
    `/social-media-posting/oauth/${LOC}/pinterest/boards/${FULL}`,
    `/social-media-posting/oauth/${LOC}/pinterest/boards/${OAUTH}`,
  ]) board_probes.push(await probe(p));

  // find a userId (create-post requires one) — try users list
  let users = null;
  try {
    const r = await fetch(`${GHL}/users/?locationId=${LOC}`, { headers: H });
    const d = await r.json().catch(() => ({}));
    users = { http: r.status, ids: (d.users || []).slice(0, 3).map(u => ({ id: u.id, name: u.name || u.email })) };
  } catch (e) { users = { error: String(e && e.message || e) }; }

  return json(200, { board_probes, users });
};
