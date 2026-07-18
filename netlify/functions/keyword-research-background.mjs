// BACKGROUND fn (auto 202; client polls the keyword_runs row).
// POST { run_id, blog, seeds:[..], broaden?:bool }
//   1. DataForSEO: expand each seed (keyword_suggestions) + optional broad net (keyword_ideas),
//      merge, dedupe, attach live volume / difficulty / CPC, drop already-covered terms.
//   2. Claude: cluster the keywords into postable topics, score each for THIS brand's reader,
//      suggest a title + angle, flag anything off-brand or overlapping an existing post.
//   3. Write the result to keyword_runs[run_id] (status done/error) for the client to poll.
import { BRANDS } from './_lib/brands.mjs';
import { keywordSuggestions, keywordIdeas, dfsConfigured } from './_lib/dataforseo.mjs';

const MODEL = 'claude-opus-4-8';
const AKEY = process.env.ANTHROPIC_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpprrknnkjyluhgtoezu.supabase.co';
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const TOOL = {
  name: 'emit_keyword_plan',
  description: 'Cluster the supplied keywords into postable blog topics, scored for this brand.',
  input_schema: {
    type: 'object',
    properties: {
      clusters: {
        type: 'array',
        description: 'One entry per postable topic. Group keywords that a single article would target. Omit purely off-topic keywords.',
        items: {
          type: 'object',
          properties: {
            topic: { type: 'string', description: 'Short human label for the cluster (3-6 words).' },
            primary_keyword: { type: 'string', description: 'The single best primary keyword for the post — MUST be copied exactly from the supplied list.' },
            supporting_keywords: { type: 'array', items: { type: 'string' }, description: 'Other keywords from the list this one article would also cover (exact strings from the list).' },
            suggested_title: { type: 'string', description: 'A compelling blog H1 for this topic, in the brand voice.' },
            angle: { type: 'string', description: 'One sentence: the specific angle/take that fits THIS brand reader.' },
            intent: { type: 'string', enum: ['informational', 'commercial', 'transactional', 'navigational'] },
            opportunity: { type: 'integer', description: '0-100. Reward real search volume and low difficulty AND strong fit with the brand reader; penalise off-brand or brutally competitive terms.' },
            relevant: { type: 'boolean', description: 'True only if this is genuinely on-topic and worth writing for this brand.' },
            overlaps_existing: { type: 'string', description: 'If it duplicates an existing post (from the provided list), the existing title. Otherwise "".' },
            rationale: { type: 'string', description: 'Short reason for the score (volume/difficulty/fit).' },
          },
          required: ['topic', 'primary_keyword', 'supporting_keywords', 'suggested_title', 'angle', 'intent', 'opportunity', 'relevant', 'overlaps_existing'],
        },
      },
    },
    required: ['clusters'],
  },
};

function buildPrompt(b, keywords, covered) {
  const list = keywords.map((k, i) =>
    `${i + 1}. "${k.keyword}" — vol ${k.volume ?? '?'}/mo, difficulty ${k.difficulty ?? '?'}/100${k.cpc ? `, $${k.cpc} CPC` : ''}`
  ).join('\n');
  const cov = covered.length ? covered.map(t => `- ${t}`).join('\n') : '(none provided)';
  return `You are a keyword strategist for ${b.name}.

READER: ${b.reader}
POSITIONING: ${b.positioning}

Cluster the keywords below into postable blog topics for this reader. Return the 12-18 HIGHEST-OPPORTUNITY clusters — you do NOT need to place every keyword; ignore weak or off-topic ones. Group keywords one article would naturally target into a single cluster. For each cluster pick the strongest primary keyword (exact string from the list), suggest an H1 title in the brand voice, give a one-sentence angle, classify intent, and score the opportunity 0-100 (balance real search volume, low keyword difficulty, AND genuine fit with this reader — a high-volume keyword that is off-brand or that this reader would never search is a LOW opportunity).

Set relevant:false for keywords that are off-topic noise (the expansion API sometimes returns unrelated terms). Set overlaps_existing to an existing title if the topic duplicates one of our current posts.

KEYWORDS (with live search volume + difficulty):
${list}

OUR EXISTING POSTS (do not propose duplicates — flag overlaps):
${cov}

Return the plan via the emit_keyword_plan tool.`;
}

const CLUSTER_TOOL = {
  name: 'emit_content_cluster',
  description: 'Design a topic cluster: one comprehensive pillar post + several supporting posts that all link up to it.',
  input_schema: {
    type: 'object',
    properties: {
      cluster_name: { type: 'string', description: 'Short label for the whole cluster (1-3 words, e.g. "GoHighLevel", "Email Marketing").' },
      pillar: {
        type: 'object',
        description: 'The single comprehensive hub post for the whole topic — broad, authoritative, the page everything else links to.',
        properties: {
          suggested_title: { type: 'string', description: 'H1 for the pillar — broad and definitive (e.g. "The Complete Guide to ...").' },
          primary_keyword: { type: 'string', description: 'The broad head keyword for the pillar — MUST be copied exactly from the supplied list.' },
          supporting_keywords: { type: 'array', items: { type: 'string' }, description: 'Other broad keywords the pillar covers (exact strings from the list).' },
          angle: { type: 'string', description: 'One sentence: the pillar\'s angle for this brand reader.' },
          intent: { type: 'string', enum: ['informational', 'commercial', 'transactional', 'navigational'] },
        },
        required: ['suggested_title', 'primary_keyword', 'supporting_keywords', 'angle', 'intent'],
      },
      supporting: {
        type: 'array',
        description: '6-12 supporting posts, each targeting a DISTINCT sub-topic of the pillar (a specific keyword from the list). Each will link up to the pillar.',
        items: {
          type: 'object',
          properties: {
            topic: { type: 'string', description: 'Short label (3-6 words).' },
            suggested_title: { type: 'string', description: 'H1 for this supporting post, in the brand voice.' },
            primary_keyword: { type: 'string', description: 'The sub-topic keyword — MUST be copied exactly from the supplied list.' },
            supporting_keywords: { type: 'array', items: { type: 'string' } },
            angle: { type: 'string', description: 'One sentence angle for this reader.' },
            intent: { type: 'string', enum: ['informational', 'commercial', 'transactional', 'navigational'] },
            opportunity: { type: 'integer', description: '0-100 (volume + low difficulty + brand fit).' },
            overlaps_existing: { type: 'string', description: 'Existing post title if this duplicates one, else "".' },
          },
          required: ['topic', 'suggested_title', 'primary_keyword', 'supporting_keywords', 'angle', 'intent', 'opportunity', 'overlaps_existing'],
        },
      },
    },
    required: ['cluster_name', 'pillar', 'supporting'],
  },
};

function buildClusterPrompt(b, topic, keywords, covered) {
  const list = keywords.map((k, i) =>
    `${i + 1}. "${k.keyword}" — vol ${k.volume ?? '?'}/mo, difficulty ${k.difficulty ?? '?'}/100`
  ).join('\n');
  const cov = covered.length ? covered.map(t => `- ${t}`).join('\n') : '(none provided)';
  return `You are planning a TOPIC CLUSTER for ${b.name} around: "${topic}".

READER: ${b.reader}
POSITIONING: ${b.positioning}

A topic cluster = ONE comprehensive PILLAR post on the broad topic, plus 6-12 SUPPORTING posts each covering a specific sub-topic, all linking up to the pillar. This builds topical authority.

Design the cluster from the keywords below:
- Pick the PILLAR: the broadest, highest-level keyword that a definitive guide would target.
- Pick 6-12 SUPPORTING posts, each on a DISTINCT sub-topic (a different specific keyword). No two supporting posts should target the same thing. Favour real volume + winnable difficulty + genuine fit with this reader. Flag overlaps_existing for any that duplicate a current post.
- Use ONLY keywords from the list (exact strings) for primary_keyword.

KEYWORDS (with live search volume + difficulty):
${list}

OUR EXISTING POSTS (flag overlaps, don't duplicate):
${cov}

Return the cluster via the emit_content_cluster tool.`;
}

// Expand seeds -> deduped, covered-filtered, min-volume + max-difficulty-filtered,
// volume-sorted keyword list. The difficulty cutoff is a hard exclusion — keywords above
// it never reach Claude, so an impossible-to-rank head term can't slip through no matter
// how on-brand it looks (unlike the opportunity score, which is a judgment call).
async function expandKeywords(seeds, broaden, covered, minVol, maxKD) {
  const coveredNorm = new Set(covered.map(norm));
  let cost = 0;
  const calls = seeds.map(s => keywordSuggestions(s, { limit: 150 }));
  if (broaden) calls.push(keywordIdeas(seeds, { limit: 300, minVolume: 30 }));
  const results = await Promise.all(calls);
  const byKw = new Map();
  for (const r of results) {
    cost += r.cost || 0;
    for (const k of (r.keywords || [])) {
      const key = norm(k.keyword);
      if (!key || coveredNorm.has(key)) continue;
      const prev = byKw.get(key);
      if (!prev || (k.volume || 0) > (prev.volume || 0)) byKw.set(key, k);
    }
  }
  let keywords = [...byKw.values()].sort((a, c) => (c.volume || 0) - (a.volume || 0));
  const rawCount = keywords.length;
  keywords = keywords.filter(k => (k.volume || 0) >= minVol);
  const aboveMin = keywords.length;
  // difficulty is only excluded when known and over the cap — an unscored keyword isn't
  // penalised for missing data.
  keywords = keywords.filter(k => k.difficulty == null || k.difficulty <= maxKD);
  keywords = keywords.slice(0, 90);
  return { keywords, rawCount, aboveMin, cost };
}

async function callClaudeTool(tool, prompt, maxTokens) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': AKEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, tools: [tool], tool_choice: { type: 'tool', name: tool.name }, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const tu = (data.content || []).find(x => x.type === 'tool_use');
  if (!tu) throw new Error('No tool_use in Claude response');
  return tu.input;
}

// Attach live DataForSEO metrics back onto a Claude-produced idea/post.
function enrich(c, metric) {
  const all = [c.primary_keyword, ...(c.supporting_keywords || [])].map(norm);
  const ms = all.map(n => metric.get(n)).filter(Boolean);
  const vol = ms.reduce((s, m) => s + (m.volume || 0), 0);
  const kds = ms.map(m => m.difficulty).filter(v => v != null);
  const pm = metric.get(norm(c.primary_keyword));
  return {
    topic: c.topic || c.suggested_title,
    primary_keyword: c.primary_keyword,
    primary_volume: pm ? pm.volume : null,
    primary_difficulty: pm ? pm.difficulty : null,
    supporting_keywords: (c.supporting_keywords || []).filter(k => metric.has(norm(k))),
    total_volume: vol,
    avg_difficulty: kds.length ? Math.round(kds.reduce((s, v) => s + v, 0) / kds.length) : null,
    suggested_title: c.suggested_title,
    angle: c.angle,
    intent: c.intent,
    opportunity: c.opportunity,
    overlaps_existing: c.overlaps_existing || '',
    rationale: c.rationale || '',
  };
}
const round = (x) => Math.round(x * 10000) / 10000;

async function runIdeas(blog, seeds, broaden, covered, minVolume, maxDifficulty) {
  const b = BRANDS[blog];
  const minVol = Number.isFinite(minVolume) ? minVolume : 100;
  const maxKD = Number.isFinite(maxDifficulty) ? maxDifficulty : 100;
  const { keywords, rawCount, aboveMin, cost } = await expandKeywords(seeds, broaden, covered, minVol, maxKD);
  if (!keywords.length) return { mode: 'ideas', clusters: [], counts: { raw: rawCount, aboveMin: 0, used: 0, clusters: 0 }, minVolume: minVol, maxDifficulty: maxKD, cost: round(cost), note: `No new keywords at ${minVol}+ searches/mo and difficulty ${maxKD} or under for those seeds. Try broader seeds, lower the minimum, or raise the difficulty cap.` };
  const input = await callClaudeTool(TOOL, buildPrompt(b, keywords, covered), 8000);
  const metric = new Map(keywords.map(k => [norm(k.keyword), k]));
  const clusters = (input.clusters || [])
    .filter(c => c.relevant !== false && c.primary_keyword)
    .map(c => enrich(c, metric))
    .sort((a, c) => (c.opportunity || 0) - (a.opportunity || 0));
  return { mode: 'ideas', clusters, counts: { raw: rawCount, aboveMin, used: keywords.length, clusters: clusters.length }, minVolume: minVol, maxDifficulty: maxKD, cost: round(cost) };
}

async function runCluster(blog, seeds, broaden, covered, minVolume, maxDifficulty) {
  const b = BRANDS[blog];
  const minVol = Number.isFinite(minVolume) ? minVolume : 100;
  const maxKD = Number.isFinite(maxDifficulty) ? maxDifficulty : 100;
  const { keywords, rawCount, aboveMin, cost } = await expandKeywords(seeds, broaden, covered, minVol, maxKD);
  if (!keywords.length) return { mode: 'cluster', pillar: null, supporting: [], counts: { raw: rawCount, aboveMin: 0, used: 0 }, minVolume: minVol, maxDifficulty: maxKD, cost: round(cost), note: `No new keywords at ${minVol}+ searches/mo and difficulty ${maxKD} or under for that topic. Try a broader topic, lower the minimum, or raise the difficulty cap.` };
  const topic = seeds.join(', ');
  const input = await callClaudeTool(CLUSTER_TOOL, buildClusterPrompt(b, topic, keywords, covered), 6000);
  const metric = new Map(keywords.map(k => [norm(k.keyword), k]));
  const pillar = input.pillar && input.pillar.primary_keyword ? enrich(input.pillar, metric) : null;
  const supporting = (input.supporting || [])
    .filter(c => c.primary_keyword)
    .map(c => enrich(c, metric))
    .sort((a, c) => (c.opportunity || 0) - (a.opportunity || 0));
  return { mode: 'cluster', cluster_name: input.cluster_name || seeds[0] || topic, pillar, supporting, counts: { raw: rawCount, aboveMin, used: keywords.length, supporting: supporting.length }, minVolume: minVol, maxDifficulty: maxKD, cost: round(cost) };
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'bad JSON' }); }
  const runId = body.run_id;
  const b = BRANDS[body.blog];
  const seeds = (Array.isArray(body.seeds) ? body.seeds : []).map(s => String(s || '').trim()).filter(Boolean).slice(0, 8);

  const h = { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'content-type': 'application/json' };
  const finish = async (patch) => {
    if (!runId || !SKEY) return;
    await fetch(`${SUPABASE_URL}/rest/v1/keyword_runs?id=eq.${runId}`, {
      method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' },
      body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
    }).catch(() => {});
  };

  // Guardrails — write the error to the row so the client surfaces it.
  if (!runId) return json(400, { error: 'run_id required' });
  if (!AKEY || !SKEY) { await finish({ status: 'error', error: 'Server not configured (ANTHROPIC_API_KEY / SUPABASE_SERVICE_ROLE_KEY).' }); return json(500, {}); }
  if (!dfsConfigured()) { await finish({ status: 'error', error: 'DataForSEO not configured.' }); return json(500, {}); }
  if (!b) { await finish({ status: 'error', error: 'unknown blog' }); return json(400, {}); }
  if (!seeds.length) { await finish({ status: 'error', error: 'provide at least one seed keyword' }); return json(400, {}); }

  try {
    // Pull existing posts for the brand so Claude can flag duplicates.
    const posts = await (await fetch(`${SUPABASE_URL}/rest/v1/posts?blog=eq.${body.blog}&select=title,primary_keyword`, { headers: h })).json();
    const covered = [...new Set((posts || []).flatMap(p => [p.title, p.primary_keyword]).filter(Boolean))];

    const minVolume = Number.isFinite(+body.min_volume) ? Math.max(0, +body.min_volume) : 100;
    const maxDifficulty = Number.isFinite(+body.max_difficulty) ? Math.min(100, Math.max(0, +body.max_difficulty)) : 100;
    const out = body.mode === 'cluster'
      ? await runCluster(body.blog, seeds, !!body.broaden, covered, minVolume, maxDifficulty)
      : await runIdeas(body.blog, seeds, !!body.broaden, covered, minVolume, maxDifficulty);
    await finish({ status: 'done', result: out, cost: out.cost });
    return json(200, out);
  } catch (e) {
    await finish({ status: 'error', error: String(e && e.message || e) });
    return json(502, { error: String(e && e.message || e) });
  }
};
