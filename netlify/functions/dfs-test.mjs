// TEMPORARY: validates keywordIdeas() returns real data. Removed after verifying.
import { keywordIdeas, keywordSuggestions } from './_lib/dataforseo.mjs';
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });

export const handler = async (event) => {
  const q = event.queryStringParameters || {};
  const seed = q.seed || 'gohighlevel for agencies';
  try {
    const r = q.mode === 'suggest'
      ? await keywordSuggestions(seed, { limit: 15 })
      : await keywordIdeas(seed.split('|'), { limit: 12, minVolume: 10 });
    return json(200, {
      configured: r.configured, cost: r.cost, seeds: r.seeds || r.seed,
      count: (r.keywords || []).length,
      sample: (r.keywords || []).slice(0, 12),
    });
  } catch (e) { return json(200, { error: String(e && e.message || e) }); }
};
