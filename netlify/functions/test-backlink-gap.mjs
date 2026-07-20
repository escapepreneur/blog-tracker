// TEMP test function — verifies DataForSEO's domain_intersection backlinks endpoint
// works with the existing account and shows real gap-analysis data. Delete after testing.
const LOGIN = process.env.DATAFORSEO_LOGIN, PW = process.env.DATAFORSEO_PASSWORD;
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });

export const handler = async () => {
  if (!LOGIN || !PW) return json(500, { error: 'no creds' });
  const auth = 'Basic ' + Buffer.from(`${LOGIN}:${PW}`).toString('base64');
  const task = {
    targets: { 1: 'kartra.com', 2: 'kajabi.com', 3: 'clickfunnels.com' },
    exclude_targets: ['eschub.com'],
    limit: 20,
    order_by: ['1.backlinks,desc'],
  };
  const r = await fetch('https://api.dataforseo.com/v3/backlinks/domain_intersection/live', {
    method: 'POST', headers: { Authorization: auth, 'content-type': 'application/json' }, body: JSON.stringify([task]),
  });
  const d = await r.json().catch(() => ({}));
  return json(200, { httpStatus: r.status, statusCode: d.status_code, statusMessage: d.status_message, cost: d.cost, task: d.tasks && d.tasks[0] });
};
