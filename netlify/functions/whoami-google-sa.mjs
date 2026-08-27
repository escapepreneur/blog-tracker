// TEMPORARY diagnostic — delete after use. Returns only the service account's
// client_email (never the private key) so Karen knows exactly which identity to
// grant Search Console access to.
import { getServiceAccount } from './_lib/google.mjs';
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
export const handler = async () => {
  const sa = getServiceAccount();
  if (!sa) return json(500, { error: 'GOOGLE_SA_KEY not configured or unparseable' });
  return json(200, { client_email: sa.client_email, project_id: sa.project_id });
};
