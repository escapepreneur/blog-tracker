// GET ?blog=esc|nms&url=<page-url> -> live Search Console metrics for ONE post's page.
// Returns the 90-day page aggregate {clicks,impressions,ctr,position} + the top queries
// it ranks for. Used by the post modal (current numbers + health flags) and to capture
// the "before" baseline when Sienna logs an optimization.
// Read-only; uses the GOOGLE_SA_KEY service account (owner on both GSC properties).
import { BRANDS } from './_lib/brands.mjs';
import { searchAnalytics, getServiceAccount } from './_lib/google.mjs';

const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
const ymd = (d) => d.toISOString().slice(0, 10);

export const handler = async (event) => {
  if (!getServiceAccount()) return json(500, { error: 'GOOGLE_SA_KEY not configured.' });
  const q = event.queryStringParameters || {};
  const blog = q.blog || 'esc';
  const url = (q.url || '').trim();
  const b = BRANDS[blog];
  if (!b || !b.gscProperty) return json(400, { error: 'unknown blog' });
  if (!url) return json(400, { error: 'missing url' });

  const now = new Date();
  const end = new Date(now); end.setDate(end.getDate() - 3);   // GSC lags ~2-3 days
  const start = new Date(now); start.setDate(start.getDate() - 90);
  const range = { start: ymd(start), end: ymd(end) };
  const pageFilter = [{ dimension: 'page', operator: 'equals', expression: url }];

  try {
    const [pageRows, queryRows] = await Promise.all([
      searchAnalytics({ siteUrl: b.gscProperty, startDate: range.start, endDate: range.end, dimensions: ['page'], filters: pageFilter, rowLimit: 1 }),
      searchAnalytics({ siteUrl: b.gscProperty, startDate: range.start, endDate: range.end, dimensions: ['query'], filters: pageFilter, rowLimit: 25 }),
    ]);
    const pr = pageRows[0];
    const page = pr ? { clicks: pr.clicks, impressions: pr.impressions, ctr: pr.ctr, position: pr.position } : null;
    const queries = (queryRows || []).map(r => ({
      query: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position,
    }));
    return json(200, { blog, url, range, page, queries });
  } catch (e) {
    return json(502, { error: String(e && e.message || e) });
  }
};
