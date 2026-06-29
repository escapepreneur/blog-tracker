// DataForSEO Labs keyword research. Auth = Basic (API login + API password) from
// DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD env vars. No external deps. All calls
// no-op gracefully (return {configured:false}) when creds aren't set.
const LOGIN = process.env.DATAFORSEO_LOGIN, PW = process.env.DATAFORSEO_PASSWORD;
const BASE = 'https://api.dataforseo.com/v3';

export function dfsConfigured() { return !!(LOGIN && PW); }

function authHeader() {
  return 'Basic ' + Buffer.from(`${LOGIN}:${PW}`).toString('base64');
}

async function post(path, task) {
  if (!dfsConfigured()) return { configured: false };
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'content-type': 'application/json' },
    body: JSON.stringify([task]), // DataForSEO takes an array of tasks
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.status_code !== 20000) {
    throw new Error(`dataforseo ${path} ${r.status}/${d.status_code}: ${(d.status_message || '').slice(0, 160)}`);
  }
  const t = d.tasks && d.tasks[0];
  if (!t || t.status_code !== 20000) {
    throw new Error(`dataforseo ${path} task ${t && t.status_code}: ${(t && t.status_message || '').slice(0, 160)}`);
  }
  return { configured: true, cost: d.cost, result: (t.result && t.result[0]) || null };
}

// Normalise a Labs item into the shape the rest of the app uses.
function norm(item) {
  const ki = item.keyword_info || {};
  const kp = item.keyword_properties || {};
  return {
    keyword: item.keyword,
    volume: ki.search_volume == null ? null : ki.search_volume,
    cpc: ki.cpc == null ? null : ki.cpc,
    competition: ki.competition == null ? null : ki.competition,       // 0..1
    competition_level: ki.competition_level || null,                   // LOW/MEDIUM/HIGH
    difficulty: kp.keyword_difficulty == null ? null : kp.keyword_difficulty, // 0..100
  };
}

// Seed expansion: hand it 1+ seed phrases, get back related keywords WITH search
// volume, CPC, competition, and keyword difficulty in one call.
// opts: { location='United States', language='English', limit=200, minVolume=0 }
export async function keywordIdeas(seeds, opts = {}) {
  const list = (Array.isArray(seeds) ? seeds : [seeds]).map(s => String(s || '').trim()).filter(Boolean);
  if (!list.length) return { configured: dfsConfigured(), keywords: [] };
  const { result, cost, configured } = await post('/dataforseo_labs/google/keyword_ideas/live', {
    keywords: list.slice(0, 200),
    location_name: opts.location || 'United States',
    language_name: opts.language || 'English',
    limit: Math.min(opts.limit || 200, 1000),
    order_by: ['keyword_info.search_volume,desc'],
    ...(opts.minVolume ? { filters: [['keyword_info.search_volume', '>=', opts.minVolume]] } : {}),
  });
  if (configured === false) return { configured: false, keywords: [] };
  const items = (result && result.items) || [];
  return { configured: true, cost, seeds: list, keywords: items.map(norm).filter(k => k.keyword) };
}

// Long-tail suggestions that CONTAIN a single seed phrase (full-search variations).
export async function keywordSuggestions(seed, opts = {}) {
  const kw = String(seed || '').trim();
  if (!kw) return { configured: dfsConfigured(), keywords: [] };
  const { result, cost, configured } = await post('/dataforseo_labs/google/keyword_suggestions/live', {
    keyword: kw,
    location_name: opts.location || 'United States',
    language_name: opts.language || 'English',
    limit: Math.min(opts.limit || 200, 1000),
    order_by: ['keyword_info.search_volume,desc'],
  });
  if (configured === false) return { configured: false, keywords: [] };
  const items = (result && result.items) || [];
  return { configured: true, cost, seed: kw, keywords: items.map(norm).filter(k => k.keyword) };
}
