// TEMPORARY: confirms DATAFORSEO_LOGIN/PASSWORD authenticate. Removed after verifying.
const LOGIN = process.env.DATAFORSEO_LOGIN, PW = process.env.DATAFORSEO_PASSWORD;
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });

export const handler = async () => {
  if (!LOGIN || !PW) return json(200, { ok: false, hasLogin: !!LOGIN, hasPassword: !!PW, note: 'one or both env vars missing' });
  try {
    const auth = Buffer.from(`${LOGIN}:${PW}`).toString('base64');
    const r = await fetch('https://api.dataforseo.com/v3/appendix/user_data', { headers: { Authorization: `Basic ${auth}` } });
    const d = await r.json().catch(() => ({}));
    const res = d.tasks && d.tasks[0] && d.tasks[0].result && d.tasks[0].result[0];
    return json(200, {
      ok: r.status === 200 && d.status_code === 20000,
      http: r.status, status_code: d.status_code, status_message: d.status_message,
      login: res && res.login, balance: res && res.money && res.money.balance, currency: res && res.money && res.money.currency,
    });
  } catch (e) { return json(200, { ok: false, error: String(e && e.message || e) }); }
};
