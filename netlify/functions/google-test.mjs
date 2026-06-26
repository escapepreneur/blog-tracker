// TEMPORARY diagnostic: confirms GOOGLE_SA_KEY works (auth + Indexing API + URL
// Inspection). Removed right after verifying the setup.
import { requestIndexing, inspectIndexed, getServiceAccount } from './_lib/google.mjs';
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });

export const handler = async () => {
  const sa = getServiceAccount();
  const out = { sa_loaded: !!sa, client_email: sa && sa.client_email };
  const url = 'https://escapepreneur.com/post/career-change-at-40';
  try { out.requestIndexing = await requestIndexing(url); } catch (e) { out.requestIndexing_error = String(e && e.message || e); }
  try { out.inspectIndexed = await inspectIndexed('sc-domain:escapepreneur.com', url); } catch (e) { out.inspectIndexed_error = String(e && e.message || e); }
  return json(200, out);
};
