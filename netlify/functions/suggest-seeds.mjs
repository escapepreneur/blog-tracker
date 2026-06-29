// POST { blog, theme?, covered?:[..titles/keywords..] }
// Claude proposes strong SEED terms (short head keywords) for this brand to feed into
// the keyword researcher — grouped by category, favouring areas not already covered.
// Synchronous + small output, so it returns in a few seconds.
import { BRANDS } from './_lib/brands.mjs';

const MODEL = 'claude-sonnet-4-6';
const AKEY = process.env.ANTHROPIC_API_KEY;
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });

const TOOL = {
  name: 'emit_seeds',
  description: 'Return seed keywords for keyword research.',
  input_schema: {
    type: 'object',
    properties: {
      seeds: {
        type: 'array',
        description: '15-25 short SEED keywords (1-3 words, head terms — NOT long-tail phrases) this brand should research.',
        items: {
          type: 'object',
          properties: {
            term: { type: 'string', description: 'The seed keyword — short and broad (e.g. "gohighlevel", "email marketing", "sales funnel"), not a full question or sentence.' },
            category: { type: 'string', enum: ['Topic / theme', 'Product / feature', 'Competitor', 'Problem / pain', 'Audience'], description: 'Which kind of seed this is.' },
          },
          required: ['term', 'category'],
        },
      },
    },
    required: ['seeds'],
  },
};

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  if (!AKEY) return json(500, { error: 'ANTHROPIC_API_KEY not configured.' });
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'bad JSON' }); }
  const b = BRANDS[body.blog];
  if (!b) return json(400, { error: 'unknown blog' });
  const theme = String(body.theme || '').trim();
  const covered = (Array.isArray(body.covered) ? body.covered : []).map(s => String(s || '').trim()).filter(Boolean).slice(0, 120);

  const prompt = `You are planning keyword research for ${b.name}.

READER: ${b.reader}
POSITIONING: ${b.positioning}

Propose 15-25 strong SEED keywords to research for this brand. Seeds must be SHORT, broad head terms (1-3 words) — things like "gohighlevel", "email marketing", "sales funnel", "client onboarding" — NOT long-tail phrases or questions (the researcher expands each seed into long-tail itself). Spread them across the categories: core topics/themes, products/features, competitor names, problems/pains the reader has, and audience terms.
${theme ? `\nFOCUS THIS ROUND ON: "${theme}" — bias the seeds toward this area.\n` : ''}
${covered.length ? `\nWe have ALREADY covered the topics below — favour seeds that open NEW or adjacent territory rather than repeating these:\n${covered.map(t => `- ${t}`).join('\n')}\n` : ''}
Return them via the emit_seeds tool.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': AKEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL, max_tokens: 1500,
        tools: [TOOL], tool_choice: { type: 'tool', name: 'emit_seeds' },
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    const tu = (data.content || []).find(x => x.type === 'tool_use');
    if (!tu) throw new Error('No tool_use in response');
    const seeds = (tu.input.seeds || []).filter(s => s && s.term);
    return json(200, { blog: body.blog, theme, seeds });
  } catch (e) {
    return json(502, { error: String(e && e.message || e) });
  }
};
