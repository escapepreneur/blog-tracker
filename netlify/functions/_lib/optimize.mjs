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

// Which ranking keywords are already in the article text, and which are missing.
// Token-based + morphology-tolerant (mirrors the checker's matching).
const STOP = new Set(['a', 'an', 'the', 'for', 'of', 'to', 'in', 'on', 'and', 'or', 'your', 'my', 'as', 'at', 'with', 'is', 'are', 'do', 'does', 'how', 'what', 'why', 'vs']);
const kwTokens = (kw) => String(kw || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
  .filter(w => w && !STOP.has(w)).map(w => w.replace(/(?:es|s)$/i, ''));
export function keywordCoverage(bodyText, keywords) {
  const hay = String(bodyText || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const covered = [], missing = [];
  for (const k of (keywords || [])) {
    const toks = kwTokens(k.query);
    const present = toks.length && toks.every(t => t.length < 3 || hay.includes(t));
    (present ? covered : missing).push(k);
  }
  return { covered, missing };
}

const ADD_TOOL = {
  name: 'emit_addition',
  description: 'Return a new HTML section to APPEND to an existing, already-ranking blog post so it covers the search terms it is missing. Do not rewrite existing content.',
  input_schema: {
    type: 'object',
    properties: {
      added_html: { type: 'string', description: 'Clean HTML to append at the end of the article. Use <h2>/<h3>/<p> and, for FAQs, a question-style <h2> + <h3> question + <p> answer per item. No inline styles, no <script>, no class attributes (the blog theme styles it). Should read as a natural, valuable addition (e.g. an FAQ or a clear definition section), in the brand voice, honest to the article.' },
      summary: { type: 'string', description: '1 sentence: what section you added and which terms it covers.' },
    },
    required: ['added_html', 'summary'],
  },
};

// Generate an additive section covering the missing keywords, matching the article + brand.
export async function improveBodyAdditive({ brand, title, currentHtml, missing, anthropicKey, model = MODEL }) {
  const miss = (missing || []).slice(0, 15).map(k => `- "${k.query}"${k.impressions ? ` (${k.impressions} impr/90d)` : ''}`).join('\n');
  const plain = String(currentHtml || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 5000);
  const user = `This is a LIVE ${BRANDS[brand].name} blog post that already ranks in Google. Its title is "${title || ''}". People find it searching terms it does not yet clearly cover. Write a NEW section to APPEND to the end of the article that naturally covers those terms — do NOT rewrite or repeat the existing content.

TERMS TO COVER (searchers reach the post via these but the article under-serves them):
${miss || '(none)'}

EXISTING ARTICLE (for context/voice — do not repeat it):
${plain}

Prefer a genuinely useful FAQ (question-style H2, then H3 question + P answer per item) or a clear definition section — whatever best answers those searches. Keep it concise, honest, on brand, and non-repetitive. Return via emit_addition.`;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model, max_tokens: 2500, system: systemPrompt(brand),
      tools: [ADD_TOOL], tool_choice: { type: 'tool', name: 'emit_addition' },
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const tu = (data.content || []).find(b => b.type === 'tool_use');
  if (!tu) throw new Error('no tool_use in response');
  return tu.input;
}

// Refine the current title + meta per a plain-English instruction. Fast model for snappy iteration.
export async function refineTitleMeta({ brand, currentTitle, currentMeta, instruction, keywords, anthropicKey, model = 'claude-sonnet-5' }) {
  const kw = (keywords || []).slice(0, 12).map(k => `"${k.query}"`).join(', ');
  const user = `Here is the current SEO title + meta description for a LIVE ${BRANDS[brand].name} blog post that already ranks but is under-clicked. Apply the instruction and return the revised pair.

CURRENT TITLE: ${currentTitle || ''}
CURRENT META DESCRIPTION: ${currentMeta || ''}
KEYWORDS IT RANKS FOR: ${kw || '(none)'}

INSTRUCTION: ${instruction}

Apply the instruction. Keep it solid SEO/CTR: title ideally <=60 chars leading with the main term, meta 150-160 chars covering the main keyword(s), honest, on brand, compelling. Return via emit_title_meta.`;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: 1500, system: systemPrompt(brand), tools: [TOOL], tool_choice: { type: 'tool', name: 'emit_title_meta' }, messages: [{ role: 'user', content: user }] }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const tu = (data.content || []).find(b => b.type === 'tool_use');
  if (!tu) throw new Error('no tool_use in response');
  return tu.input;
}

// Refine the FULL article body per a plain-English instruction (add/adjust only, keep everything).
export async function refineBodySection({ brand, title, currentBody, instruction, anthropicKey, model = MODEL }) {
  const user = `Here is the FULL article HTML for a LIVE ${BRANDS[brand].name} blog post titled "${title || ''}". Apply the instruction and return the FULL revised article.

CURRENT ARTICLE HTML:
${currentBody || ''}

INSTRUCTION: ${instruction}

Keep ALL existing content — add or adjust only what the instruction asks; do not delete sections, links or images. Clean HTML (<h2>/<h3>/<p>), no <script>, no class attributes, on brand. Return via emit_woven_body.`;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: 16000, system: systemPrompt(brand), tools: [WOVEN_TOOL], tool_choice: { type: 'tool', name: 'emit_woven_body' }, messages: [{ role: 'user', content: user }] }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  if (data.stop_reason && data.stop_reason !== 'tool_use') throw new Error(`revision stopped: ${data.stop_reason} (article may be too long)`);
  const tu = (data.content || []).find(b => b.type === 'tool_use');
  if (!tu) throw new Error('no tool_use in response');
  return tu.input;
}

const WOVEN_TOOL = {
  name: 'emit_woven_body',
  description: 'Return the FULL article HTML with coverage for the missing keywords woven into the right places. Additive only — keep every existing section.',
  input_schema: {
    type: 'object',
    properties: {
      body_html: { type: 'string', description: 'The COMPLETE revised article HTML. Keep ALL existing content — do not delete or rewrite existing paragraphs/headings. Insert the new coverage where it naturally belongs (e.g. a definition near the top section, not at the end) and MERGE any new Q&As into the existing FAQ section rather than adding a second one. Preserve existing internal links, the resource/CTA link, images and structure. Clean HTML only (<h2>/<h3>/<p>), no <script>, no class attributes, no new inline styles.' },
      summary: { type: 'string', description: '1-2 sentences: what was added and where it was placed/merged.' },
      changes: { type: 'array', items: { type: 'string' }, description: 'Short bullets of each addition and where it went.' },
    },
    required: ['body_html', 'summary'],
  },
};

// Weave coverage for the missing keywords INTO the full article (additive; existing
// content preserved). Returns the complete revised body_html.
export async function improveBodyWoven({ brand, title, currentHtml, missing, anthropicKey, model = MODEL }) {
  const miss = (missing || []).slice(0, 15).map(k => `- "${k.query}"${k.impressions ? ` (${k.impressions} impr/90d)` : ''}`).join('\n');
  const user = `This is a LIVE ${BRANDS[brand].name} blog post that already ranks in Google. Title: "${title || ''}". Revise the FULL article to cover the search terms it under-serves — woven into the RIGHT places, not tacked on the end.

TERMS TO COVER:
${miss || '(none)'}

RULES:
- Keep EVERY existing section, paragraph, heading, link and image. Add only — do not delete or rewrite existing content (light connective sentences are fine).
- Put each addition where it belongs: definitions/"what it means" near the relevant top section; extra Q&As MERGED INTO the existing FAQ section (do not create a second FAQ).
- Keep the existing internal links, the resource/CTA link, and the overall structure/voice intact.

CURRENT ARTICLE HTML:
${currentHtml || ''}

Return the complete revised article via emit_woven_body.`;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: 16000, system: systemPrompt(brand), tools: [WOVEN_TOOL], tool_choice: { type: 'tool', name: 'emit_woven_body' }, messages: [{ role: 'user', content: user }] }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  if (data.stop_reason && data.stop_reason !== 'tool_use') throw new Error(`generation stopped: ${data.stop_reason} (article may be too long)`);
  const tu = (data.content || []).find(b => b.type === 'tool_use');
  if (!tu) throw new Error('no tool_use in response');
  return tu.input;
}

// Compare a revised body against the original: flag lost headings / shrinkage (safety
// for "don't lose anything"). Returns a warning string ('' if all good).
export function bodyLossCheck(originalHtml, revisedHtml) {
  const strip = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const heads = (h) => [...String(h || '').matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean);
  const revLow = strip(revisedHtml).toLowerCase();
  const lostHeads = heads(originalHtml).filter(hd => !revLow.includes(hd.toLowerCase().slice(0, 45)));
  const oLen = strip(originalHtml).length, rLen = strip(revisedHtml).length;
  const warns = [];
  if (lostHeads.length) warns.push(`${lostHeads.length} original heading(s) not found in the revision (${lostHeads.slice(0, 3).map(h => `"${h.slice(0, 40)}"`).join(', ')}) — check nothing was dropped.`);
  if (rLen < oLen * 0.9) warns.push(`Revised article is shorter than the original (${rLen} vs ${oLen} chars) — verify nothing was removed.`);
  return warns.join(' ');
}

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
