// Google service-account auth + Indexing API + Search Console URL Inspection.
// Reads the service-account JSON from the GOOGLE_SA_KEY env var (the whole JSON as
// a string). No external deps — signs the JWT with node:crypto. All calls no-op
// gracefully when the key isn't configured, so the pipeline works without it.
import { createSign } from 'node:crypto';

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const _tokenCache = {}; // scope -> { token, exp }

export function getServiceAccount() {
  const raw = process.env.GOOGLE_SA_KEY;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function getAccessToken(sa, scope) {
  const now = Math.floor(Date.now() / 1000);
  const cached = _tokenCache[scope];
  if (cached && cached.exp > now + 60) return cached.token;
  const tokenUri = sa.token_uri || 'https://oauth2.googleapis.com/token';
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({ iss: sa.client_email, scope, aud: tokenUri, iat: now, exp: now + 3600 }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  const jwt = `${header}.${claim}.${b64url(signer.sign(sa.private_key))}`;
  const res = await fetch(tokenUri, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`google token ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
  _tokenCache[scope] = { token: data.access_token, exp: now + (data.expires_in || 3600) };
  return data.access_token;
}

// Ask Google to (re)crawl a URL — the API equivalent of "Request Indexing" in GSC.
// Returns { ok } / { skipped } (no key) / throws on API error.
export async function requestIndexing(url, sa) {
  sa = sa || getServiceAccount();
  if (!sa) return { ok: false, skipped: true };
  const token = await getAccessToken(sa, 'https://www.googleapis.com/auth/indexing');
  const res = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ url, type: 'URL_UPDATED' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`indexing ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
  return { ok: true };
}

// Pull Search Console performance rows (query data). Returns an array of rows
// [{keys:[...], clicks, impressions, ctr, position}] or [] (no key / error).
export async function searchAnalytics({ siteUrl, startDate, endDate, dimensions = ['query'], rowLimit = 5000, sa }) {
  sa = sa || getServiceAccount();
  if (!sa) return [];
  const token = await getAccessToken(sa, 'https://www.googleapis.com/auth/webmasters.readonly');
  const res = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ startDate, endDate, dimensions, rowLimit, dataState: 'all' }),
  });
  if (!res.ok) throw new Error(`searchAnalytics ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json().catch(() => ({}));
  return data.rows || [];
}

// Inspect a URL's index status. Returns 'yes' | 'no' | null (no key / error).
export async function inspectIndexed(siteUrl, pageUrl, sa) {
  sa = sa || getServiceAccount();
  if (!sa) return null;
  const token = await getAccessToken(sa, 'https://www.googleapis.com/auth/webmasters.readonly');
  const res = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ inspectionUrl: pageUrl, siteUrl }),
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));
  const cov = data?.inspectionResult?.indexStatusResult?.coverageState || '';
  return /indexed/i.test(cov) ? 'yes' : 'no';
}
