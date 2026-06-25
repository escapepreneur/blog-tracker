// Auto-fix pass: deterministically strip em/en dashes, then do ONE targeted
// Claude rewrite to remove any banned-word slips, so a clean draft reaches the
// reviewer instead of a flagged one. (Same idea as the Software Updates brand-guard.)
import { BANNED, BANNED_PHRASES } from './brands.mjs';

function bannedHits(text = '') {
  const found = [];
  for (const w of BANNED) {
    const re = new RegExp(`(?<![a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z])`, 'i');
    if (re.test(text)) found.push(w);
  }
  for (const p of BANNED_PHRASES) if (text.toLowerCase().includes(p.toLowerCase())) found.push(p);
  return [...new Set(found)];
}

export async function autoFix({ draft, anthropicKey, model = 'claude-opus-4-8' }) {
  const d = { ...draft };
  // 1. dashes — deterministic
  for (const k of ['body_html', 'title', 'meta_title', 'meta_description']) {
    if (typeof d[k] === 'string') d[k] = d[k].replace(/—/g, ' - ').replace(/–/g, '-');
  }
  // 2. banned words — one targeted rewrite if any remain
  const blob = [d.body_html, d.title, d.meta_title, d.meta_description].filter(Boolean).join(' ');
  const found = bannedHits(blob);
  if (!found.length) return { draft: d, fixed: [] };

  const tool = {
    name: 'emit_fixed', description: 'Return the corrected fields.',
    input_schema: { type: 'object', properties: {
      title: { type: 'string' }, meta_title: { type: 'string' },
      meta_description: { type: 'string' }, body_html: { type: 'string' },
    }, required: ['title', 'meta_title', 'meta_description', 'body_html'] },
  };
  const prompt = `These blog fields contain words/phrases banned in this brand's voice. Rewrite to REMOVE every one of them, swapping in plainer wording. Keep the meaning, the HTML structure, every link, the CTA and the voice identical. Change nothing else.

BANNED TO REMOVE: ${found.join(', ')}

title: ${d.title}
meta_title: ${d.meta_title}
meta_description: ${d.meta_description}
body_html:
${d.body_html}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: 8000, tools: [tool], tool_choice: { type: 'tool', name: 'emit_fixed' }, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) return { draft: d, fixed: [], error: `autofix ${res.status}` };
  const data = await res.json();
  const tu = (data.content || []).find(b => b.type === 'tool_use');
  return { draft: tu ? { ...d, ...tu.input } : d, fixed: found };
}
