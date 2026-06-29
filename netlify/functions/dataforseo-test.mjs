// TEMPORARY: confirms DATAFORSEO_LOGIN/PASSWORD authenticate. Removed after verifying.
const LOGIN = process.env.DATAFORSEO_LOGIN, PW = process.env.DATAFORSEO_PASSWORD;
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });

export const handler = async () => {
  if (!LOGIN || !PW) return json(200, { ok: false, hasLogin: !!LOGIN, hasPassword: !!PW, note: 'one or both env vars missing' });
  const diag = {
    login_value: LOGIN,                       // the login is just an email — safe to show
    login_has_whitespace: LOGIN !== LOGIN.trim(),
    password_length: PW.length,
    password_trimmed_length: PW.trim().length,
    password_has_whitespace: PW !== PW.trim(),
  };
  const tryAuth = async (l, p) => {
    const auth = Buffer.from(`${l}:${p}`).toString('base64');
    const r = await fetch('https://api.dataforseo.com/v3/appendix/user_data', { headers: { Authorization: `Basic ${auth}` } });
    const d = await r.json().catch(() => ({}));
    const res = d.tasks && d.tasks[0] && d.tasks[0].result && d.tasks[0].result[0];
    return { http: r.status, status_code: d.status_code, ok: r.status === 200 && d.status_code === 20000, login: res && res.login, balance: res && res.money && res.money.balance, currency: res && res.money && res.money.currency };
  };
  try {
    const asis = await tryAuth(LOGIN, PW);
    const trimmed = (diag.login_has_whitespace || diag.password_has_whitespace) ? await tryAuth(LOGIN.trim(), PW.trim()) : null;
    return json(200, { ok: asis.ok || (trimmed && trimmed.ok) || false, diag, asis, trimmed });
  } catch (e) { return json(200, { ok: false, diag, error: String(e && e.message || e) }); }
};
