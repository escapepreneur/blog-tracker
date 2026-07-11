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

const REVIEW_TOOL = {
  name: 'emit_review',
  description: 'Review a proposed SEO title + meta description and judge whether it will earn the click.',
  input_schema: {
    type: 'object',
    properties: {
      verdict: { type: 'string', enum: ['strong', 'ok', 'weak'], description: 'strong = ship it; ok = works, minor nits; weak = needs work.' },
      notes: { type: 'array', items: { type: 'string' }, description: '1-4 short, specific notes (length problems, missing top keyword, clarity, brand voice, click-worthiness). Empty array if it is strong with nothing to flag.' },
    },
    required: ['verdict', 'notes'],
  },
};

// Review a (possibly human-edited) title + meta. Fast model, sync-friendly.
export async function reviewTitleMeta({ brand, title, meta, keywords, anthropicKey, model = 'claude-sonnet-5' }) {
  const kw = (keywords || []).slice(0, 10).map(k => `"${k.query}"`).join(', ');
  const user = `Review this proposed SEO title + meta description for a ${BRANDS[brand].name} blog post that already ranks in Google but is under-clicked. Judge whether it earns the click and matches search intent.

TITLE (${(title || '').length} chars): ${title || ''}
META DESCRIPTION (${(meta || '').length} chars): ${meta || ''}
TOP KEYWORDS IT RANKS FOR: ${kw || '(none)'}

Guidance: title ideally <=60 chars (over ~70 truncates in Google), meta 150-160 chars, leads with what searchers actually type, works in the top keyword(s), honest to the article, on brand, compelling. Return emit_review with a verdict and short specific notes (empty notes if it's strong).`;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model, max_tokens: 700, system: systemPrompt(brand),
      tools: [REVIEW_TOOL], tool_choice: { type: 'tool', name: 'emit_review' },
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const tu = (data.content || []).find(b => b.type === 'tool_use');
  if (!tu) throw new Error('no tool_use in response');
  return tu.input;
}

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
