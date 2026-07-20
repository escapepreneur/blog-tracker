// POST { run_id, blog } -> DataForSEO domain_intersection finds domains that link to this
// brand's competitors but not to it, THEN Claude classifies each one: is this a realistic,
// low-effort outreach opportunity (e.g. a tool directory that lists competitors and would
// list anyone), or a dead end (a major platform's own editorial content, or a hosting
// platform where the actual link belongs to an individual creator, not the platform)?
// Company-size mismatch alone does NOT make something a dead end — a directory site's
// business model is comprehensiveness, not prestige. Background fn (Claude call), writes
// to backlink_gap_runs for the client to poll.
const LOGIN = process.env.DATAFORSEO_LOGIN, PW = process.env.DATAFORSEO_PASSWORD;
const AKEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-opus-4-8';
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpprrknnkjyluhgtoezu.supabase.co';
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Per-brand competitor set + own domain to exclude. NMS has no clear named competitors
// yet (personal-brand blog, not competing against specific named companies), so only
// ESC Hub is wired up for now — add an 'nms' entry here once that's scoped.
const CONFIG = {
  esc: { name: 'ESC Hub', description: 'an all-in-one business platform (CRM, funnels, email, bookings) for coaches and solopreneurs', competitors: ['kartra.com', 'kajabi.com', 'clickfunnels.com', 'teachable.com'], ownDomain: 'eschub.com' },
};

const MIN_RANK = 100;   // DataForSEO rank is 0-1000; below this is barely-indexed noise
const MAX_SPAM = 25;    // spam score is 0-100, higher = riskier link profile

const EXCLUDE_DOMAINS = new Set([
  'bit.ly', 'tinyurl.com', 't.co', 'ow.ly', 'buff.ly', 'rebrand.ly', 'cutt.ly', 'is.gd', 'goo.gl',
  'player.fm', 'podchaser.com', 'listennotes.com', 'castbox.fm', 'podcasts.apple.com', 'open.spotify.com',
  'youtube.com', 'soundcloud.com', 'web.archive.org', 'archive.org',
  'facebook.com', 'twitter.com', 'x.com', 'linkedin.com', 'instagram.com', 'pinterest.com', 'reddit.com',
]);
const isInfra = (domain) => {
  const d = String(domain || '').toLowerCase().replace(/^www\./, '');
  if ([...EXCLUDE_DOMAINS].some(x => d === x || d.endsWith('.' + x))) return true;
  if (/pod/.test(d)) return true;
  return false;
};

// DataForSEO's backlink index is built from historical crawls — a domain that once linked
// to a competitor may since have expired, been parked, or restructured its URLs, so it's
// worth confirming the homepage still resolves before recommending outreach to it. Only
// treat a CONFIRMED 404/410 or a connection failure (DNS, timeout) as dead — many real,
// live sites return 403 to a plain server-side fetch (bot/Cloudflare protection) without
// actually being down for a real visitor, so 403 and similar are NOT treated as dead.
async function isDead(domain) {
  for (const scheme of ['https://', 'http://']) {
    try {
      const controller = new AbortController();
      const to = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(scheme + domain, { method: 'GET', redirect: 'follow', signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EscHubBacklinkChecker/1.0)' } });
      clearTimeout(to);
      if (res.status === 404 || res.status === 410) return true;
      return false; // reached the server, got SOME response — treat as alive
    } catch (e) {
      if (scheme === 'http://') return true; // both schemes failed to connect at all
    }
  }
  return true;
}

const CLASSIFY_TOOL = {
  name: 'emit_classification',
  description: 'Classify each backlink-gap domain and judge whether it is a realistic outreach opportunity.',
  input_schema: {
    type: 'object',
    properties: {
      classifications: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            domain: { type: 'string' },
            type: { type: 'string', enum: ['directory', 'platform', 'hosting', 'low_quality', 'other'] },
            actionable: { type: 'boolean', description: 'true ONLY if a realistic, low-effort outreach ask (e.g. a tool-directory submission, a "best tools" roundup with a submit form) could plausibly get a link added — company size is irrelevant here, a directory wants comprehensiveness not prestige. false for major competing platforms/big brands whose competitor mention is their own editorial/comparison content with zero incentive to add a smaller rival, or hosting platforms (podcast/course hosts) where the actual link belongs to an individual creator using the platform, not an editorial choice by the platform itself. false for anything that looks like a low-quality/spam/SEO-farm site regardless of numeric scores.' },
            action: { type: 'string', description: 'If actionable, ONE concrete, specific next step (e.g. "Look for their submit-a-tool / suggest-an-app form and add ESC Hub"). If not actionable, empty string.' },
            reason: { type: 'string', description: '1 short, concrete sentence explaining the judgment.' },
          },
          required: ['domain', 'type', 'actionable', 'action', 'reason'],
        },
      },
    },
    required: ['classifications'],
  },
};

async function classify(brandCfg, rows) {
  if (!rows.length) return [];
  const list = rows.map(r => `- ${r.domain} (rank ${r.rank}, spam score ${r.spam}, ${r.totalBacklinks} backlinks, links to ${r.intersections} of: ${r.linksTo.join(', ')})`).join('\n');
  const prompt = `These are domains that already link to ${brandCfg.name}'s competitors (${brandCfg.competitors.join(', ')}) but do NOT link to ${brandCfg.ownDomain}. ${brandCfg.name} is ${brandCfg.description} — a small, niche player compared to these competitors.

For EACH domain, judge whether it is a realistic backlink outreach opportunity RIGHT NOW, or a dead end. Do NOT dismiss something just because ${brandCfg.name} is smaller than the competitors it's being compared to — the real question is whether the SITE ITSELF has an incentive/mechanism to add a smaller/niche tool (e.g. a directory, "best tools" roundup, or comparison list wants comprehensiveness and doesn't care about brand size), versus a dead end (a big platform's own editorial content about ITS OWN competitors, or a hosting platform where an individual creator — not the platform — made the mention).

DOMAINS:
${list}

Return via emit_classification, one entry per domain listed, using the EXACT domain string given.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': AKEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: MODEL, max_tokens: 4000,
      tools: [CLASSIFY_TOOL], tool_choice: { type: 'tool', name: 'emit_classification' },
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const tu = (data.content || []).find(b => b.type === 'tool_use');
  if (!tu) throw new Error('no tool_use in classification response');
  return tu.input.classifications || [];
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  if (!LOGIN || !PW) return json(500, { error: 'DataForSEO not configured.' });
  if (!AKEY || !SKEY) return json(500, { error: 'Server not configured.' });
  let body; try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'invalid JSON' }); }
  const runId = body.run_id;
  if (!runId) return json(400, { error: 'run_id required' });
  const cfg = CONFIG[body.blog];

  const h = { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'content-type': 'application/json' };
  const finish = async (patch) => {
    await fetch(`${SUPABASE_URL}/rest/v1/backlink_gap_runs?id=eq.${runId}`, {
      method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
    }).catch(() => {});
  };

  if (!cfg) { await finish({ status: 'error', error: 'No competitor set configured for this blog yet.' }); return json(400, {}); }

  try {
    const targets = {}; cfg.competitors.forEach((d, i) => { targets[i + 1] = d; });
    const task = { targets, exclude_targets: [cfg.ownDomain], limit: 200, order_by: ['1.backlinks,desc'] };
    const auth = 'Basic ' + Buffer.from(`${LOGIN}:${PW}`).toString('base64');

    const r = await fetch('https://api.dataforseo.com/v3/backlinks/domain_intersection/live', {
      method: 'POST', headers: { Authorization: auth, 'content-type': 'application/json' }, body: JSON.stringify([task]),
    });
    const d = await r.json().catch(() => ({}));
    if (r.status === 402 || d.status_code === 40200) { await finish({ status: 'error', error: 'DataForSEO is out of funds — add a deposit at app.dataforseo.com.' }); return json(200, {}); }
    if (!r.ok || d.status_code !== 20000) { await finish({ status: 'error', error: `dataforseo ${r.status}/${d.status_code}: ${(d.status_message || '').slice(0, 160)}` }); return json(200, {}); }
    const t = d.tasks && d.tasks[0];
    if (!t || t.status_code !== 20000) { await finish({ status: 'error', error: `dataforseo task ${t && t.status_code}: ${(t && t.status_message || '').slice(0, 160)}` }); return json(200, {}); }
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
    const candidates = qualifying.slice(0, 50);

    // Drop confirmed-dead domains before spending Claude tokens classifying them.
    const deadFlags = await Promise.all(candidates.map(r => isDead(r.domain)));
    const deadCount = deadFlags.filter(Boolean).length;
    const toClassify = candidates.filter((_, i) => !deadFlags[i]);

    const classifications = await classify(cfg, toClassify);
    const byDomain = new Map(classifications.map(c => [c.domain, c]));
    const merged = toClassify.map(r => ({ ...r, ...(byDomain.get(r.domain) || { type: 'other', actionable: false, action: '', reason: 'Not classified.' }) }));
    merged.sort((a, b) => (b.actionable - a.actionable) || (b.intersections - a.intersections) || (b.rank - a.rank));

    await finish({
      status: 'done',
      cost: d.cost,
      result: {
        blog: body.blog, competitors: cfg.competitors, ownDomain: cfg.ownDomain,
        totalFound, scanned: rows.length, qualifying: qualifying.length, deadCount,
        actionableCount: merged.filter(m => m.actionable).length,
        results: merged,
      },
    });
    return json(200, {});
  } catch (e) {
    await finish({ status: 'error', error: String(e && e.message || e) });
    return json(200, {});
  }
};
