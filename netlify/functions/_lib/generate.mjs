// Server-side draft generation. Builds the brief + brand framework, calls Claude
// with a forced tool call so we get a clean structured package back.
import { systemPrompt, BRANDS } from './brands.mjs';

const MODEL = 'claude-opus-4-8';

const TOOL = {
  name: 'emit_blog_package',
  description: 'Return the complete, publish-ready blog post package.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'The H1 headline (contains the primary keyword near the start).' },
      body_html: { type: 'string', description: 'Full article as clean HTML (<p>,<h2>,<h3>,<a>,<ul>). Includes the <!-- TOC --> marker after the intro and the exact CTA as the final paragraph. No class attributes, no <style>.' },
      meta_title: { type: 'string', description: '50-60 chars, primary keyword near the start.' },
      meta_description: { type: 'string', description: '150-160 chars, includes the primary keyword, written to earn the click.' },
      slug: { type: 'string', description: 'lowercase, hyphenated, stop words removed, based on the primary keyword.' },
      category: { type: 'string', description: 'Best-fit blog category for this post.' },
      internal_links: {
        type: 'array', description: 'The 3 in-body internal links you used, from the provided existing-posts list.',
        items: { type: 'object', properties: { anchor: { type: 'string' }, url: { type: 'string' } }, required: ['anchor','url'] },
      },
      canva_title: { type: 'string', description: 'Featured-image line 1 (white).' },
      canva_subtitle: { type: 'string', description: 'Featured-image line 2 (teal).' },
      body_image_searches: { type: 'array', items: { type: 'string' }, description: 'Stock-photo search terms, one per body image slot (2-3).' },
      facebook_caption: { type: 'string' },
      instagram_caption: { type: 'string' },
      pinterest_description: { type: 'string' },
    },
    required: ['title','body_html','meta_title','meta_description','slug','category','internal_links'],
  },
};

function buildBrief(post, brand, liveLinks) {
  const b = BRANDS[brand];
  const supp = post.supplementary_keywords || '';
  const list = (liveLinks || []).slice(0, 40)
    .map(p => `- ${p.title} -> ${p.url}`).join('\n') || '(none available)';
  return `Blog: ${b.name} (${b.blogIndex})
Primary keyword: ${post.primary_keyword || ''}
KS Score: ${post.ks_score ?? '—'}
Monthly search volume: ${post.search_volume ?? '—'}
${supp ? `Secondary keywords: ${supp}` : ''}
${post.unique_take ? `Unique take / Karen's angle: ${post.unique_take}` : ''}
${post.serp_notes ? `SERP notes: ${post.serp_notes}` : ''}

Existing ${b.name} posts you may link to (choose 3 relevant ones for in-body internal links, with descriptive anchor text):
${list}

Write the complete post now and return it via the emit_blog_package tool.`;
}

export async function generateDraft({ post, brand, liveLinks, anthropicKey, model = MODEL }) {
  const body = {
    model,
    max_tokens: 8000,
    system: systemPrompt(brand),
    tools: [TOOL],
    tool_choice: { type: 'tool', name: 'emit_blog_package' },
    messages: [{ role: 'user', content: buildBrief(post, brand, liveLinks) }],
  };
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const toolUse = (data.content || []).find(b => b.type === 'tool_use');
  if (!toolUse) throw new Error('No tool_use in response: ' + JSON.stringify(data).slice(0, 500));
  return { draft: toolUse.input, usage: data.usage, model };
}
