// POST { blog } -> DataForSEO domain_intersection: finds real domains that already link
// to this brand's competitors but not to it — genuine backlink outreach targets, not a
// content/keyword idea. Synchronous (DataForSEO responds in a few seconds). Filtered for
// quality (domain rank + spam score) and sorted by how many competitors each domain links
// to (a stronger relevance signal than raw backlink count), since raw results skew toward
// low-quality aggregator/directory sites.
const LOGIN = process.env.DATAFORSEO_LOGIN, PW = process.env.DATAFORSEO_PASSWORD;
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });

// Per-brand competitor set + own domain to exclude. NMS has no clear named competitors
// yet (personal-brand blog, not competing against specific named companies), so only
// ESC Hub is wired up for now — add an 'nms' entry here once that's scoped.
const CONFIG = {
  esc: { competitors: ['kartra.com', 'kajabi.com', 'clickfunnels.com', 'teachable.com'], ownDomain: 'eschub.com' },
};

const MIN_RANK = 100;   // DataForSEO rank is 0-1000; below this is barely-indexed noise
const MAX_SPAM = 25;    // spam score is 0-100, higher = riskier link profile

// Infrastructure/aggregator domains that legitimately have high rank + low spam but are
// NEVER real outreach targets — nobody "edits" a link shortener or podcast index to add
// you, so these just clutter the top of raw results. Not exhaustive; tune as more turn up.
const EXCLUDE_DOMAINS = new Set([
  'bit.ly', 'tinyurl.com', 't.co', 'ow.ly', 'buff.ly', 'rebrand.ly', 'cutt.ly', 'is.gd', 'goo.gl',
  'player.fm', 'podchaser.com', 'listennotes.com', 'castbox.fm', 'podcasts.apple.com', 'open.spotify.com',
  'youtube.com', 'soundcloud.com', 'web.archive.org', 'archive.org',
  'facebook.com', 'twitter.com', 'x.com', 'linkedin.com', 'instagram.com', 'pinterest.com', 'reddit.com',
]);
const isInfra = (domain) => {
  const d = String(domain || '').toLowerCase().replace(/^www\./, '');
  if ([...EXCLUDE_DOMAINS].some(x => d === x || d.endsWith('.' + x))) return true;
  // Podcast-directory sites are the dominant noise category here — GHL/Kartra/etc. get
  // mentioned as sponsors in show notes, which every podcast platform worldwide indexes.
  // There are too many (country-specific) to list individually, so pattern-match instead.
  if (/pod/.test(d)) return true;
  return false;
};

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  if (!LOGIN || !PW) return json(500, { error: 'DataForSEO not configured.' });
  let body; try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'invalid JSON' }); }
  const cfg = CONFIG[body.blog];
  if (!cfg) return json(400, { error: 'No competitor set configured for this blog yet.' });

  const targets = {}; cfg.competitors.forEach((d, i) => { targets[i + 1] = d; });
  const task = { targets, exclude_targets: [cfg.ownDomain], limit: 200, order_by: ['1.backlinks,desc'] };
  const auth = 'Basic ' + Buffer.from(`${LOGIN}:${PW}`).toString('base64');

  try {
    const r = await fetch('https://api.dataforseo.com/v3/backlinks/domain_intersection/live', {
      method: 'POST', headers: { Authorization: auth, 'content-type': 'application/json' }, body: JSON.stringify([task]),
    });
    const d = await r.json().catch(() => ({}));
    if (r.status === 402 || d.status_code === 40200) return json(402, { error: 'DataForSEO is out of funds — add a deposit at app.dataforseo.com.' });
    if (!r.ok || d.status_code !== 20000) return json(502, { error: `dataforseo ${r.status}/${d.status_code}: ${(d.status_message || '').slice(0, 160)}` });
    const t = d.tasks && d.tasks[0];
    if (!t || t.status_code !== 20000) return json(502, { error: `dataforseo task ${t && t.status_code}: ${(t && t.status_message || '').slice(0, 160)}` });
    const res0 = t.result && t.result[0];
    const items = (res0 && res0.items) || [];
    const totalFound = (res0 && res0.total_count) || 0;

    const rows = items.map(it => {
      const per = it.domain_intersection || {};
      const entries = Object.values(per).filter(Boolean);
      if (!entries.length) return null;
      const domain = entries[0].target;
      const rank = Math.max(...entries.map(e => e.rank || 0));
      const spam = Math.max(...entries.map(e => e.backlinks_spam_score ?? 0));
      const totalBacklinks = entries.reduce((s, e) => s + (e.backlinks || 0), 0);
      const linksTo = cfg.competitors.filter((_, i) => per[i + 1]);
      return { domain, rank, spam, totalBacklinks, intersections: linksTo.length, linksTo };
    }).filter(Boolean);

    const qualifying = rows.filter(r => r.rank >= MIN_RANK && r.spam <= MAX_SPAM && !isInfra(r.domain));
    qualifying.sort((a, b) => (b.intersections - a.intersections) || (b.rank - a.rank));

    return json(200, {
      ok: true, blog: body.blog, competitors: cfg.competitors, ownDomain: cfg.ownDomain,
      cost: d.cost, totalFound, scanned: rows.length, qualifying: qualifying.length,
      results: qualifying.slice(0, 50),
    });
  } catch (e) {
    return json(502, { error: String(e && e.message || e) });
  }
};
