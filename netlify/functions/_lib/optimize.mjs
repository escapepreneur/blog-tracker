// Optimise a live post's TITLE + META DESCRIPTION for click-through, using the keywords
// it already ranks for. Body is not touched (GHL locks it, and it's already ranking).
import { systemPrompt, BRANDS } from './brands.mjs';

const MODEL = 'claude-opus-4-8';
const TOOL = {
  name: 'emit_title_meta',
  description: 'Return an optimised SEO title and meta description for a post that already ranks but is under-clicked.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'New title, ideally <=60 characters, leading with the main term people actually search, compelling enough to earn the click.' },
      meta_description: { type: 'string', description: 'New meta description, 150-160 characters, includes the main keyword(s), concrete and specific, sells the click. No clickbait, no fabricated claims.' },
      rationale: { type: 'string', description: '1-2 sentences: what changed vs the current title/meta and why it should lift click-through.' },
    },
    required: ['title', 'meta_description', 'rationale'],
  },
};

export async function optimizeTitleMeta({ brand, currentTitle, currentMeta, articleText, keywords, anthropicKey, model = MODEL }) {
  const kw = (keywords || []).slice(0, 15)
    .map(k => `- "${k.query}" — pos ${(+k.position).toFixed(1)}, ${k.impressions} impr/90d, ${(k.ctr * 100).toFixed(1)}% CTR`).join('\n');
  const user = `This is a LIVE ${BRANDS[brand].name} blog post that ALREADY RANKS in Google but gets too few clicks for its impressions. Rewrite ONLY its title and meta description to earn more clicks. Do not rewrite the article.

CURRENT TITLE: ${currentTitle || '(none)'}
CURRENT META DESCRIPTION: ${currentMeta || '(none)'}

KEYWORDS IT ALREADY RANKS FOR (optimise around these — work the top, highest-impression ones in naturally):
${kw || '(no Search Console keywords returned)'}

ARTICLE TEXT (context only — do NOT rewrite it):
${(articleText || '').slice(0, 4000)}

Write a title and meta description that match what these searchers are actually looking for, in the brand voice, honest to the article. Return via emit_title_meta.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model, max_tokens: 1500, system: systemPrompt(brand),
      tools: [TOOL], tool_choice: { type: 'tool', name: 'emit_title_meta' },
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const tu = (data.content || []).find(b => b.type === 'tool_use');
  if (!tu) throw new Error('no tool_use in response');
  return tu.input;
}
