// TEMPORARY: confirms our server PIT (GHL_API_TOKEN) is scoped for the Social Planner,
// lists the connected Pinterest accounts, and probes for a boards endpoint. Removed after.
const GHL = 'https://services.leadconnectorhq.com';
const PIT = process.env.GHL_API_TOKEN;
const LOC = process.env.GHL_LOCATION_ID || 'EoD3KT6IiKx0oIXjInOt';
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
const H = { Authorization: `Bearer ${PIT}`, Version: '2021-07-28', Accept: 'application/json' };

export const handler = async () => {
  if (!PIT) return json(200, { ok: false, note: 'GHL_API_TOKEN not set' });
  const out = {};
  // 1. Accounts (confirms the PIT has social-media-posting scope)
  try {
    const r = await fetch(`${GHL}/social-media-posting/${LOC}/accounts`, { headers: H });
    const d = await r.json().catch(() => ({}));
    out.accounts_http = r.status;
    if (r.ok) {
      const accts = (d.results && d.results.accounts) || [];
      out.scoped = true;
      out.pinterest = accts.filter(a => a.platform === 'pinterest').map(a => ({ id: a.id, name: a.name, oauthId: a.oauthId }));
    } else { out.scoped = false; out.accounts_error = (d.message || JSON.stringify(d)).slice(0, 200); }
  } catch (e) { out.accounts_error = String(e && e.message || e); }

  // 2. Probe likely boards endpoints for the first Pinterest account
  if (out.pinterest && out.pinterest[0]) {
    const acct = out.pinterest[0];
    const tries = [
      `/social-media-posting/${LOC}/accounts/${acct.id}/pinterest/boards`,
      `/social-media-posting/${LOC}/pinterest/boards?accountId=${acct.id}`,
      `/social-media-posting/oauth/${acct.oauthId}/pinterest/boards?locationId=${LOC}`,
      `/social-media-posting/${LOC}/accounts/${acct.id}/boards`,
    ];
    out.board_probes = [];
    for (const path of tries) {
      try {
        const r = await fetch(GHL + path, { headers: H });
        const txt = await r.text();
        out.board_probes.push({ path, http: r.status, body: txt.slice(0, 240) });
      } catch (e) { out.board_probes.push({ path, error: String(e && e.message || e) }); }
    }
  }
  out.ok = !!out.scoped;
  return json(200, out);
};
