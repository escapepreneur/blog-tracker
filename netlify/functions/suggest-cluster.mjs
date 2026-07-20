// POST { post_id } -> Claude looks at this post against the brand's EXISTING content
// clusters and suggests either the best-fit existing one (exact name to reuse) or a new
// cluster name to start. Synchronous + small output, returns in a few seconds.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpprrknnkjyluhgtoezu.supabase.co';
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AKEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-sonnet-4-6';
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });

const TOOL = {
  name: 'emit_cluster_suggestion',
  description: 'Suggest the best existing content cluster for a post, or propose starting a new one.',
  input_schema: {
    type: 'object',
    properties: {
      matches_existing: { type: 'boolean', description: 'true only if one of the existing clusters is a genuinely strong topical fit for this post (not a loose/adjacent connection).' },
      cluster_name: { type: 'string', description: 'If matches_existing is true, the EXACT existing cluster name to use — copy it verbatim, character for character, from the list given. If matches_existing is false, a short clear name (2-4 words) for a NEW cluster this post could start, matching the naming style of the existing cluster names.' },
      rationale: { type: 'string', description: '1 sentence: why this cluster fits, or why none of the existing ones genuinely fit and a new one makes sense.' },
    },
    required: ['matches_existing', 'cluster_name', 'rationale'],
  },
};

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  if (!SKEY || !AKEY) return json(500, { error: 'Server not configured.' });
  let body; try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'invalid JSON' }); }
  const { post_id } = body;
  if (!post_id) return json(400, { error: 'post_id required' });

  const h = { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'content-type': 'application/json' };
  const rest = (q, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: h, ...opts });

  try {
    const [post] = await (await rest(`posts?id=eq.${post_id}&select=*`)).json();
    if (!post) return json(404, { error: 'post not found' });

    const siblings = await (await rest(`posts?blog=eq.${post.blog}&id=neq.${post_id}&cluster=not.is.null&select=cluster,is_pillar,title,primary_keyword`)).json();
    const groups = {};
    for (const s of (siblings || [])) {
      const c = String(s.cluster || '').trim(); if (!c) continue;
      (groups[c] = groups[c] || []).push(s);
    }
    const clusterNames = Object.keys(groups);
    if (!clusterNames.length) {
      return json(200, { matches_existing: false, cluster_name: '', rationale: 'No existing clusters yet on this blog — nothing to match against.' });
    }
    const clusterList = clusterNames.map(name => {
      const members = groups[name];
      const pillar = members.find(m => m.is_pillar);
      const sample = members.slice(0, 6).map(m => `${m.is_pillar ? '[pillar] ' : ''}${m.title || m.primary_keyword}`).join('; ');
      return `- "${name}" (${members.length} post${members.length === 1 ? '' : 's'}${pillar ? ', has a pillar' : ', no pillar yet'}): ${sample}`;
    }).join('\n');

    const postDesc = post.title || post.primary_keyword || '(untitled)';
    const prompt = `A blog post needs a topic cluster assignment for internal-linking purposes.

THIS POST: "${postDesc}"${post.primary_keyword && post.primary_keyword !== postDesc ? ` (primary keyword: "${post.primary_keyword}")` : ''}${post.supplementary_keywords ? `\nSupplementary keywords: ${post.supplementary_keywords}` : ''}${post.unique_take ? `\nAngle: ${post.unique_take}` : ''}

EXISTING CLUSTERS ON THIS BLOG:
${clusterList}

Does this post genuinely belong in one of the existing clusters (same core topic, not just loosely related), or should it start a new one? Return via emit_cluster_suggestion.`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': AKEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL, max_tokens: 500,
        tools: [TOOL], tool_choice: { type: 'tool', name: 'emit_cluster_suggestion' },
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    const tu = (data.content || []).find(x => x.type === 'tool_use');
    if (!tu) throw new Error('No tool_use in response');
    const out = tu.input || {};

    // Guard against a hallucinated "existing" name that doesn't actually match one we gave it.
    if (out.matches_existing && !clusterNames.includes(out.cluster_name)) {
      const hit = clusterNames.find(n => n.toLowerCase() === String(out.cluster_name || '').toLowerCase());
      if (hit) out.cluster_name = hit; else out.matches_existing = false;
    }
    return json(200, out);
  } catch (e) {
    return json(502, { error: String(e && e.message || e) });
  }
};
