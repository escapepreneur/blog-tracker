// TEMPORARY: verifies a service-key PATCH to keyword_runs works from a function. Removed after.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpprrknnkjyluhgtoezu.supabase.co';
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });

export const handler = async () => {
  if (!SKEY) return json(200, { ok: false, hasSKEY: false });
  const h = { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'content-type': 'application/json' };
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/keyword_runs?id=eq.11111111-1111-1111-1111-111111111111`, {
      method: 'PATCH', headers: { ...h, Prefer: 'return=representation' },
      body: JSON.stringify({ error: 'patch-probe-ok', updated_at: new Date().toISOString() }),
    });
    const txt = await r.text();
    return json(200, { ok: r.ok, status: r.status, hasSKEY: true, body: txt.slice(0, 300) });
  } catch (e) { return json(200, { ok: false, hasSKEY: true, error: String(e && e.message || e) }); }
};
