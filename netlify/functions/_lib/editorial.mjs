// Editorial pass: a Claude-judgment review of a generated draft for the things the
// mechanical checker can't see — voice, audience fit, substance, the right CTA — plus a
// deterministic check for internal links that won't resolve. Advisory: surfaced for the
// reviewer, does not hard-block publishing.
import { systemPrompt, BRANDS } from './brands.mjs';

const MODEL = 'claude-opus-4-8';

const TOOL = {
  name: 'emit_editorial_review',
  description: 'Return an editorial critique of the draft against the brand voice and standards.',
  input_schema: {
    type: 'object',
    properties: {
      overall: { type: 'string', enum: ['strong', 'minor', 'needs_work'], description: 'strong = publish as-is; minor = small tweaks; needs_work = real problems.' },
      summary: { type: 'string', description: 'One or two sentences: the honest bottom line.' },
      voice_ok: { type: 'boolean', description: 'Does it genuinely sound like this brand/author voice?' },
      voice_note: { type: 'string', description: 'Brief note on the voice — what works or what is off.' },
      audience_ok: { type: 'boolean', description: 'Does it fit the brand audience (incl. the beginner/anti-puff test)?' },
      audience_note: { type: 'string' },
      strengths: { type: 'array', items: { type: 'string' }, description: 'What is genuinely good (2-4 items).' },
      issues: {
        type: 'array',
        description: "Specific problems worth the reviewer's attention. Be concrete and quote the offending text. Do NOT raise keyword density/placement or meta-length issues — a separate mechanical checker owns those.",
        items: {
          type: 'object',
          properties: {
            severity: { type: 'string', enum: ['high', 'medium', 'low'] },
            area: { type: 'string', enum: ['voice', 'audience', 'substance', 'accuracy', 'cta', 'structure'] },
            detail: { type: 'string', description: 'What the problem is, quoting the text.' },
            fix: { type: 'string', description: 'A concrete suggested fix.' },
          },
          required: ['severity', 'area', 'detail', 'fix'],
        },
      },
    },
    required: ['overall', 'summary', 'voice_ok', 'audience_ok', 'strengths', 'issues'],
  },
};

const norm = (u) => String(u || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[#?].*$/, '').replace(/\/+$/, '');

// Flag internal /post/ links on the same blog whose URL isn't among the known post URLs
// (live posts + cluster-sibling reserved URLs) — i.e. links that will likely 404. Deterministic.
function checkLinks(brand, bodyHtml, knownUrls) {
  const b = BRANDS[brand];
  const host = norm(b.blogIndex).split('/')[0];
  const known = new Set((knownUrls || []).map(norm));
  const issues = [], seen = new Set();
  const re = /<a\s[^>]*href=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(bodyHtml || '')) !== null) {
    const n = norm(m[1]);
    if (!n.startsWith(host) || !n.includes('/post/')) continue; // same-blog post links only
    if (seen.has(n)) continue; seen.add(n);
    if (!known.has(n)) issues.push({ severity: 'high', area: 'link', detail: `Internal link "${m[1]}" doesn't match any known ${b.name} post — it will likely 404.`, fix: 'Point it at a real post, or remove the link.' });
  }
  return issues;
}

export async function editorialReview({ brand, post, draft, knownUrls, anthropicKey, model = MODEL }) {
  const b = BRANDS[brand];
  const cta = (b.leadMagnets || []).find(m => m.key === draft.cta_choice);
  const prompt = `You are an exacting editor for ${b.name}. Review this draft as if deciding whether it can go live under the brand's name, judging it against the brand voice, audience and standards in your instructions.

Focus on what a mechanical checker CANNOT see: does it truly sound like the brand's voice, does it respect the audience (apply the brand's beginner/anti-puff test), is it substantive and accurate rather than generic, is the conclusion earned, and did it use the CORRECT primary call-to-action for this brand. Do NOT raise keyword density/placement or meta-length issues — those are handled elsewhere.

For No More Somedays specifically: any personal story beats must be real and drawn from Karen's actual history (in your instructions) — flag anything that reads invented or off-canon.

DRAFT
Primary keyword: ${post.primary_keyword || ''}
Intended angle: ${post.unique_take || '—'}
H1 title: ${draft.title || ''}
Meta title: ${draft.meta_title || ''}
CTA used (lead magnet): ${cta ? cta.label : (draft.cta_choice || 'none')}
Slug: ${draft.slug || ''}

Article HTML:
${draft.body_html || ''}

Return your critique via the emit_editorial_review tool.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model, max_tokens: 3000, system: systemPrompt(brand),
      tools: [TOOL], tool_choice: { type: 'tool', name: 'emit_editorial_review' },
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const tu = (data.content || []).find(c => c.type === 'tool_use');
  if (!tu) throw new Error('No tool_use in editorial response');
  const out = tu.input;

  // Merge deterministic link checks (more reliable than asking the model to spot 404s).
  const linkIssues = checkLinks(brand, draft.body_html, knownUrls);
  out.issues = [...linkIssues, ...(out.issues || [])];
  if (linkIssues.length && out.overall === 'strong') out.overall = 'minor';
  out.checked_at = new Date().toISOString();
  out.model = model;
  return out;
}
