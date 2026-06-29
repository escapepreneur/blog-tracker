// GET ?blog=esc|nms -> keyword opportunities mined from Google Search Console
// performance data for that brand's property. Two kinds:
//   striking  - queries ranking position ~5-20 with real impressions (a nudge gets page 1)
//   lowCtr    - page-1 queries (pos <=10) with lots of impressions but weak CTR (title/meta fix)
// Read-only; uses the GOOGLE_SA_KEY service account (owner on both GSC properties).
import { BRANDS } from './_lib/brands.mjs';
import { searchAnalytics, getServiceAccount } from './_lib/google.mjs';

const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
const ymd = (d) => d.toISOString().slice(0, 10);

export const handler = async (event) => {
  if (!getServiceAccount()) return json(500, { error: 'GOOGLE_SA_KEY not configured.' });
  const blog = (event.queryStringParameters && event.queryStringParameters.blog) || 'esc';
  const b = BRANDS[blog];
  if (!b || !b.gscProperty) return json(400, { error: 'unknown blog' });

  const now = new Date();
  const end = new Date(now); end.setDate(end.getDate() - 3);   // GSC lags ~2-3 days
  const start = new Date(now); start.setDate(start.getDate() - 90);

  try {
    const rows = await searchAnalytics({ siteUrl: b.gscProperty, startDate: ymd(start), endDate: ymd(end), dimensions: ['query', 'page'], rowLimit: 5000 });
    const items = rows.map(r => ({
      query: r.keys[0], page: r.keys[1],
      clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position,
    })).filter(x => x.query && !/^https?:/.test(x.query)); // drop any odd rows

    const striking = items
      .filter(x => x.position >= 4.5 && x.position <= 20 && x.impressions >= 25)
      .sort((a, b2) => b2.impressions - a.impressions).slice(0, 40);

    const lowCtr = items
      .filter(x => x.position <= 10 && x.impressions >= 150 && x.ctr < 0.02)
      .sort((a, b2) => b2.impressions - a.impressions).slice(0, 25);

    return json(200, {
      blog, range: { start: ymd(start), end: ymd(end) },
      counts: { rows: items.length, striking: striking.length, lowCtr: lowCtr.length },
      striking, lowCtr,
    });
  } catch (e) {
    return json(502, { error: String(e && e.message || e) });
  }
};
