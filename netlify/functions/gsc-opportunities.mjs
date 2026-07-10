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
    const raw = rows.map(r => ({
      query: r.keys[0], page: r.keys[1],
      clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position,
    })).filter(x => x.query && !/^https?:/.test(x.query)); // drop any odd rows

    // GSC reports in-page anchor links (…/post/x#uuid — heading/TOC jump-links) as
    // separate "pages", so one post's data for a keyword fragments across many rows.
    // Strip the #fragment and merge by query+page so each shows once with combined
    // impressions + an impression-weighted position.
    const agg = new Map();
    for (const r of raw) {
      const page = (r.page || '').split('#')[0];
      const key = r.query + '\n' + page;
      const a = agg.get(key) || { query: r.query, page, clicks: 0, impressions: 0, _posw: 0 };
      a.clicks += r.clicks; a.impressions += r.impressions; a._posw += (r.position || 0) * r.impressions;
      agg.set(key, a);
    }
    const items = [...agg.values()].map(a => ({
      query: a.query, page: a.page, clicks: a.clicks, impressions: a.impressions,
      ctr: a.impressions ? a.clicks / a.impressions : 0,
      position: a.impressions ? a._posw / a.impressions : 0,
    }));

    // Assign each keyword to exactly ONE bucket so it never shows in two sections.
    // Priority: page-1 weak-CTR (clearest fix) > striking (just off page 1) > page 2-3.
    //   lowCtr   - pos <=10, >=150 impr, <2% CTR      -> title/meta tweak
    //   striking - pos 4.5-20, >=25 impr              -> nudge to page 1
    //   growing  - pos 20-50, >=100 impr              -> big-lift page 2-3 (was hidden by the old pos<=20 cap)
    const byImpr = [...items].sort((a, b2) => b2.impressions - a.impressions);
    const striking = [], lowCtr = [], growing = [];
    for (const x of byImpr) {
      if (x.position <= 10 && x.impressions >= 150 && x.ctr < 0.02) { if (lowCtr.length < 25) lowCtr.push(x); }
      else if (x.position >= 4.5 && x.position <= 20 && x.impressions >= 25) { if (striking.length < 40) striking.push(x); }
      else if (x.position > 20 && x.position <= 50 && x.impressions >= 100) { if (growing.length < 25) growing.push(x); }
    }

    return json(200, {
      blog, range: { start: ymd(start), end: ymd(end) },
      counts: { rows: items.length, striking: striking.length, lowCtr: lowCtr.length, growing: growing.length },
      striking, lowCtr, growing,
    });
  } catch (e) {
    return json(502, { error: String(e && e.message || e) });
  }
};
