// POST { post_id } -> generates a draft for that post, runs the checker,
// saves to post_drafts, advances status idea->drafted, returns the verdict.
// Server-side only: ANTHROPIC_API_KEY and SUPABASE_SERVICE_ROLE_KEY stay in
// Netlify env vars and never reach the browser.
import { generateDraft } from './_lib/generate.mjs';
import { autoFix } from './_lib/brandguard.mjs';
import { runChecks } from './_lib/checker.mjs';
import { searchPexels } from './_lib/pexels.mjs';
import { syncInternalLinks } from './_lib/links.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpprrknnkjyluhgtoezu.supabase.co';
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AKEY = process.env.ANTHROPIC_API_KEY;
const PEXELS = process.env.PEXELS_API_KEY;
const GH_TOKEN = process.env.GITHUB_DISPATCH_TOKEN; // optional: triggers the featured-image render worker

const json = (code, obj) => ({ statusCode: code, headers: { 'content-type': 'application/json' }, body: JSON.stringify(obj) });

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  if (!SKEY || !AKEY) return json(500, { error: 'Server not configured (missing SUPABASE_SERVICE_ROLE_KEY or ANTHROPIC_API_KEY).' });

  let postId;
  try { postId = JSON.parse(event.body || '{}').post_id; } catch { return json(400, { error: 'invalid JSON body' }); }
  if (!postId) return json(400, { error: 'post_id required' });

  const h = { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'content-type': 'application/json' };
  const rest = (q, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: h, ...opts });

  try {
    const [post] = await (await rest(`posts?id=eq.${postId}&select=*`)).json();
    if (!post) return json(404, { error: 'post not found' });
    const brand = post.blog;

    const live = await (await rest(`posts?blog=eq.${brand}&status=eq.live&url=not.is.null&select=title,primary_keyword,url`)).json();
    const liveLinks = live.map(p => ({ title: p.title || p.primary_keyword, url: p.url }));

    const gen = await generateDraft({ post, brand, liveLinks, anthropicKey: AKEY });
    const { draft, fixed } = await autoFix({ draft: gen.draft, anthropicKey: AKEY });
    const { usage, model } = gen;
    const report = runChecks({ brand, post, draft });

    let bodyImages = [];
    if (PEXELS && Array.isArray(draft.body_image_searches)) {
      for (const term of draft.body_image_searches.slice(0, 4)) {
        bodyImages.push({ term, candidates: await searchPexels(term, PEXELS, 3), chosen: null });
      }
    }

    const row = {
      post_id: postId, body_html: draft.body_html, meta_title: draft.meta_title,
      meta_description: draft.meta_description, slug: draft.slug, category: draft.category,
      internal_links: draft.internal_links,
      assets: {
        canva_title: draft.canva_title, canva_subtitle: draft.canva_subtitle,
        body_image_searches: draft.body_image_searches, facebook_caption: draft.facebook_caption,
        instagram_caption: draft.instagram_caption, pinterest_description: draft.pinterest_description,
        faq: draft.faq, title: draft.title, body_images: bodyImages,
        featured_title: draft.featured_title, featured_tagline: draft.featured_tagline, featured_image_search: draft.featured_image_search,
        cta_choice: draft.cta_choice,
      },
      check_report: report, model, generated_at: new Date().toISOString(),
    };
    await rest('post_drafts?on_conflict=post_id', {
      method: 'POST', headers: { ...h, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(row),
    });
    if (['idea', 'drafted'].includes(post.status)) {
      const patch = { status: 'drafted', current_step: Math.max(post.current_step || 0, 2) };
      if (!post.title) patch.title = draft.title; // fill the H1 title if the tracker has none
      await rest(`posts?id=eq.${postId}`, {
        method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify(patch),
      });
    }
    // Auto-record this post's internal/page links in the Links tracker (best-effort).
    try { await syncInternalLinks({ supabaseUrl: SUPABASE_URL, headers: h, postId, brand, bodyHtml: draft.body_html }); } catch (e) { /* links sync is best-effort */ }

    if (GH_TOKEN) { // ask GitHub Actions to render the featured image (await so it sends before the fn returns)
      try {
        await fetch('https://api.github.com/repos/escapepreneur/blog-tracker/dispatches', {
          method: 'POST',
          headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: 'application/vnd.github+json', 'content-type': 'application/json' },
          body: JSON.stringify({ event_type: 'render-featured', client_payload: { post_id: postId } }),
        });
      } catch (e) { /* non-fatal: featured image can be rendered via the workflow manually */ }
    }
    return json(200, { ok: true, verdict: report.verdict, report, model, usage });
  } catch (e) {
    return json(500, { error: String(e && e.message || e) });
  }
};
