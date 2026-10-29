// Scheduled every 5 minutes (see netlify.toml). Publishes any scheduled post whose go-live
// moment (15:00 SAST on its date) has passed. No auth guard on purpose: Netlify scheduled
// functions cannot be called over HTTP, and a guard that looks for a bearer token would reject
// every scheduled run. Errors return 500 (Cloudflare masks 502/503/504).
import { publishDue } from './_lib/publishdue.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpprrknnkjyluhgtoezu.supabase.co';

export const handler = async () => {
  try {
    const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
    const h = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
    const rest = (q, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: h, ...opts });
    const r = await publishDue({ rest, h, pit: process.env.GHL_API_TOKEN });
    console.log(`[publish-due] published=${r.published.length} waiting=${r.waiting} skipped=${r.skipped} failed=${r.failed.length}`);
    return { statusCode: r.failed.length ? 500 : 200, body: JSON.stringify(r) };
  } catch (e) {
    console.error('[publish-due] FAILED:', e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
