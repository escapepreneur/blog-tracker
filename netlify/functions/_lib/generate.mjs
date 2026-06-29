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
      featured_title: { type: 'string', description: 'Short, punchy featured-image headline (3-6 words) — scroll-stopping, may differ from the H1. The renderer splits it into a balanced two lines (white + teal).' },
      featured_tagline: { type: 'string', description: 'Short script tagline for the featured image (4-7 words) that complements the title.' },
      featured_image_search: { type: 'string', description: 'A stock-photo search term for a relevant, visually strong hero background (people/work/lifestyle suiting the topic; avoid text-heavy or busy images).' },
      body_image_searches: { type: 'array', items: { type: 'string' }, description: 'Stock-photo search terms, one per body image slot (2-3).' },
      facebook_caption: { type: 'string' },
      instagram_caption: { type: 'string' },
      pinterest_description: { type: 'string' },
      faq: { type: 'array', description: 'The FAQ items used at the end of the article (for AI citation + future schema markup).', items: { type: 'object', properties: { question: { type: 'string' }, answer: { type: 'string' } }, required: ['question','answer'] } },
      cta_choice: { type: 'string', description: 'The key of the single lead-magnet resource you linked in the body (must match one of the provided options).' },
    },
    required: ['title','body_html','meta_title','meta_description','slug','category','internal_links','featured_title','featured_tagline','featured_image_search','cta_choice'],
  },
};

// Brand-specific copy of the tool with cta_choice constrained to that brand's lead magnets.
function toolFor(brand) {
  const keys = (BRANDS[brand].leadMagnets || []).map(m => m.key);
  const t = JSON.parse(JSON.stringify(TOOL));
  if (keys.length) t.input_schema.properties.cta_choice.enum = keys;
  return t;
}

function buildBrief(post, brand, liveLinks, clusterLinks) {
  const b = BRANDS[brand];
  const supp = post.supplementary_keywords || '';
  const all = liveLinks || [];
  const list = all.slice(0, 40)
    .map(p => `- ${p.title} -> ${p.url}`).join('\n') || '(none available)';

  // Cluster-aware linking: if this post belongs to a topic cluster, the pillar and sibling
  // posts in the same cluster are mandatory/preferred internal links. clusterLinks (reserved
  // URLs, passed during a full cluster launch) take priority over only-live candidates.
  let clusterBlock = '';
  const cluster = post.cluster && String(post.cluster).trim();
  if (cluster) {
    const pool = (clusterLinks && clusterLinks.length)
      ? clusterLinks.filter(p => p.url && p.url !== post._selfUrl)
      : all.filter(p => p.cluster && p.cluster.trim().toLowerCase() === cluster.toLowerCase());
    const same = pool;
    const pillar = same.find(p => p.is_pillar);
    const siblings = same.filter(p => !p.is_pillar);
    const lines = [];
    if (pillar) lines.push(`- PILLAR (link to this): ${pillar.title} -> ${pillar.url}`);
    siblings.forEach(p => lines.push(`- sibling: ${p.title} -> ${p.url}`));
    clusterBlock = `

TOPIC CLUSTER: this post is part of the "${cluster}" cluster${post.is_pillar ? ' and IS the pillar post' : ''}.
${lines.length ? `Live posts in this cluster:\n${lines.join('\n')}` : 'No other posts in this cluster are live yet.'}
Internal-linking rule for clusters: ${post.is_pillar
  ? 'as the pillar, link DOWN to as many of the live sibling posts above as fit naturally (these can exceed the usual 3).'
  : (pillar ? 'you MUST include a link to the PILLAR post above (descriptive anchor), then link to relevant siblings before any other posts.' : 'link to relevant sibling posts above before any other posts.')}`;
  }

  return `Blog: ${b.name} (${b.blogIndex})
Primary keyword: ${post.primary_keyword || ''}
KS Score: ${post.ks_score ?? '—'}
Monthly search volume: ${post.search_volume ?? '—'}
${supp ? `Secondary keywords: ${supp}` : ''}
${post.unique_take ? `Unique take / Karen's angle: ${post.unique_take}` : ''}
${post.serp_notes ? `SERP notes: ${post.serp_notes}` : ''}

Existing ${b.name} posts you may link to (choose 3 relevant ones for in-body internal links, with descriptive anchor text):
${list}${clusterBlock}

Write the complete post now and return it via the emit_blog_package tool.`;
}

export async function generateDraft({ post, brand, liveLinks, clusterLinks, anthropicKey, model = MODEL }) {
  const body = {
    model,
    max_tokens: 8000,
    system: systemPrompt(brand),
    tools: [toolFor(brand)],
    tool_choice: { type: 'tool', name: 'emit_blog_package' },
    messages: [{ role: 'user', content: buildBrief(post, brand, liveLinks, clusterLinks) }],
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
