// POST { post_id } -> runs the editorial pass (Claude judgment + deterministic link check)
// on the saved draft and stores it on post_drafts.editorial. Background (auto 202; the client
// polls the row for editorial.checked_at). Advisory only — does not change the publish gate.
import { editorialReview } from './_lib/editorial.mjs';
import { slugify, publicUrl } from './_lib/ghl.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpprrknnkjyluhgtoezu.supabase.co';
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AKEY = process.env.ANTHROPIC_API_KEY;
const json = (code, obj) => ({ statusCode: code, headers: { 'content-type': 'application/json' }, body: JSON.stringify(obj) });

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  if (!SKEY || !AKEY) return json(500, { error: 'Server not configured (SUPABASE/ANTHROPIC).' });
  let postId;
  try { postId = JSON.parse(event.body || '{}').post_id; } catch { return json(400, { error: 'invalid JSON' }); }
  if (!postId) return json(400, { error: 'post_id required' });

  const h = { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'content-type': 'application/json' };
  const rest = (q, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: h, ...opts });

  try {
    const [post] = await (await rest(`posts?id=eq.${postId}&select=*`)).json();
    if (!post) return json(404, { error: 'post not found' });
    const brand = post.blog;
    const [draftRow] = await (await rest(`post_drafts?post_id=eq.${postId}&select=*`)).json();
    if (!draftRow) return json(404, { error: 'no draft to review' });

    const draft = {
      title: (draftRow.assets && draftRow.assets.title) || post.title || post.primary_keyword,
      body_html: draftRow.body_html, meta_title: draftRow.meta_title, meta_description: draftRow.meta_description,
      slug: draftRow.slug, cta_choice: draftRow.assets && draftRow.assets.cta_choice,
    };

    // Known post URLs for link validation: brand posts that already have a URL, PLUS every
    // cluster member's expected URL (live url, stored draft slug, or slugify(title)) so the
    // pillar's legitimate sibling links aren't false-flagged before the cluster is published.
    const known = await (await rest(`posts?blog=eq.${brand}&url=not.is.null&select=url`)).json();
    const knownUrls = (known || []).map(p => p.url);
    if (post.cluster) {
      const members = await (await rest(`posts?blog=eq.${brand}&cluster=eq.${encodeURIComponent(post.cluster)}&select=id,title,primary_keyword,url`)).json();
      const ids = (members || []).map(m => m.id);
      const dmap = {};
      if (ids.length) {
        const drows = await (await rest(`post_drafts?post_id=in.(${ids.join(',')})&select=post_id,slug`)).json();
        (drows || []).forEach(d => { if (d.slug) dmap[d.post_id] = d.slug; });
      }
      for (const m of (members || [])) {
        if (m.url) knownUrls.push(m.url);
        if (dmap[m.id]) knownUrls.push(publicUrl(brand, dmap[m.id]));
        knownUrls.push(publicUrl(brand, slugify(m.title || m.primary_keyword)));
      }
    }

    const editorial = await editorialReview({ brand, post, draft, knownUrls, anthropicKey: AKEY });
    await rest(`post_drafts?post_id=eq.${postId}`, {
      method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ editorial }),
    });
    return json(200, { ok: true, editorial });
  } catch (e) {
    return json(500, { error: String(e && e.message || e) });
  }
};
