// GET -> { configured, balance } for the DataForSEO balance chip in the header.
// Returns 200 even on error (with {error}) so the UI degrades gracefully.
import { getBalance } from './_lib/dataforseo.mjs';

const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });

export const handler = async () => {
  try { return json(200, await getBalance()); }
  catch (e) { return json(200, { configured: true, error: String(e && e.message || e) }); }
};
