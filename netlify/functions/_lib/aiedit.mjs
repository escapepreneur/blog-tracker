// AI edit: revise an existing draft per an instruction, keeping voice/structure intact.
import { systemPrompt, BRANDS } from './brands.mjs';

const MODEL = 'claude-opus-4-8';
const TOOL = {
  name: 'emit_revision',
  description: 'Return the full revised draft fields.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Revised H1 headline.' },
      body_html: { type: 'string', description: 'Full revised article HTML (keep links, CTA, TOC marker, headings).' },
      meta_title: { type: 'string' },
      meta_description: { type: 'string' },
    },
    required: ['title', 'body_html', 'meta_title', 'meta_description'],
  },
};

export async function reviseDraft({ post, draft, instruction, anthropicKey, model = MODEL }) {
  const brand = post.blog;
  const a = draft.assets || {};
  const user = `Here is the current ${BRANDS[brand].name} blog draft.

TITLE (H1): ${a.title || ''}
META TITLE: ${draft.meta_title || ''}
META DESCRIPTION: ${draft.meta_description || ''}
BODY HTML:
${draft.body_html || ''}

EDITOR INSTRUCTION: ${instruction}

Apply the instruction, changing only what is needed. Keep the internal links, the contextual lead-magnet resource link, the <!-- TOC --> marker, the headings/structure and the voice intact (do not add a hard-sell CTA at the end - the page footer handles that). Return the full revised title, body_html, meta_title and meta_description via the emit_revision tool.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model, max_tokens: 8000, system: systemPrompt(brand),
      tools: [TOOL], tool_choice: { type: 'tool', name: 'emit_revision' },
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const tu = (data.content || []).find(b => b.type === 'tool_use');
  if (!tu) throw new Error('no tool_use in response');
  return tu.input;
}
