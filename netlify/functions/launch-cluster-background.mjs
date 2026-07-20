// BACKGROUND fn (auto 202; client polls the cluster_launches row).
// POST { launch_id, blog, cluster, dry_run? }
// Launches a whole topic cluster in one go, fully interlinked:
//   1. Reserve a unique slug/URL for every not-yet-published post in the cluster.
//   2. Generate each post with the FULL cluster URL map, so every post links to the
//      pillar + relevant siblings using their final URLs (pillar links down to all).
//   3. Create them all in GHL as PUBLISHED (body is final at create time), mark live,
//      request indexing, record internal links, and dispatch the featured-image render.
// dry_run:true does everything EXCEPT the GHL create (returns what it would publish).
import { BRANDS } from './_lib/brands.mjs';
import { generateDraft } from './_lib/generate.mjs';
import { autoFix } from './_lib/brandguard.mjs';
import { runChecks } from './_lib/checker.mjs';
import { searchPexels } from './_lib/pexels.mjs';
import { syncInternalLinks } from './_lib/links.mjs';
import { createBlogPost, slugExists, slugify, publicUrl } from './_lib/ghl.mjs';
import { requestIndexing } from './_lib/google.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpprrknnkjyluhgtoezu.supabase.co';
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AKEY = process.env.ANTHROPIC_API_KEY;
const PIT = process.env.GHL_API_TOKEN;
const PEXELS = process.env.PEXELS_API_KEY;
const GH_TOKEN = process.env.GITHUB_DISPATCH_TOKEN;
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
const CONCURRENCY = 3;

// Run async mapper over items with a small concurrency cap (protects rate limits + memory).
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx); }
  }));
  return out;
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'bad JSON' }); }
  const { launch_id, blog, cluster, dry_run, publish_prepared } = body;
  const b = BRANDS[blog];

  const h = { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'content-type': 'application/json' };
  const rest = (q, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: h, ...opts });
  const finish = async (patch) => {
    if (!launch_id || !SKEY) return;
    await rest(`cluster_launches?id=eq.${launch_id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }) }).catch(() => {});
  };

  if (!launch_id) return json(400, { error: 'launch_id required' });
  if (!SKEY || !AKEY) { await finish({ status: 'error', error: 'Server not configured (SUPABASE/ANTHROPIC).' }); return json(500, {}); }
  if (!PIT) { await finish({ status: 'error', error: 'GHL_API_TOKEN not configured.' }); return json(500, {}); }
  if (!b) { await finish({ status: 'error', error: 'unknown blog' }); return json(400, {}); }
  if (!cluster) { await finish({ status: 'error', error: 'cluster required' }); return json(400, {}); }

  try {
    // 1. Gather the cluster's posts.
    const posts = await (await rest(`posts?blog=eq.${blog}&cluster=eq.${encodeURIComponent(cluster)}&select=*`)).json();
    if (!posts || !posts.length) { await finish({ status: 'error', error: 'No posts found in that cluster.' }); return json(200, {}); }
    const alreadyLive = posts.filter(p => p.ghl_post_id && p.url);
    const toPublish = posts.filter(p => !p.ghl_post_id);
    if (!toPublish.length) { await finish({ status: 'done', result: { published: [], skipped: posts.map(p => ({ title: p.title, reason: 'already live' })), note: 'Every post in this cluster is already live.' } }); return json(200, {}); }

    // PUBLISH-PREPARED: ship the drafts a previous Prepare (dry_run) pass already generated —
    // to their reserved slugs, WITHOUT regenerating — so what Karen reviewed is exactly what
    // goes live. Bodies already cross-link to the reserved URLs, so they interlink on publish.
    if (publish_prepared) {
      const ids = toPublish.map(p => p.id);
      const drafts = await (await rest(`post_drafts?post_id=in.(${ids.join(',')})&select=*`)).json();
      const draftBy = {}; (drafts || []).forEach(d => { draftBy[d.post_id] = d; });
      const missing = toPublish.filter(p => !draftBy[p.id]);
      const failing = toPublish.filter(p => draftBy[p.id] && draftBy[p.id].check_report && draftBy[p.id].check_report.verdict === 'fail');
      if (missing.length || failing.length) {
        const parts = [];
        if (missing.length) parts.push(`${missing.length} not prepared yet — run Prepare first`);
        if (failing.length) parts.push(`${failing.length} still have must-fix issues: ` + failing.map(p => `"${p.title || p.primary_keyword}"`).join(', '));
        await finish({ status: 'error', error: `Can't publish — ${parts.join('; ')}.` });
        return json(200, {});
      }
      await finish({ status: 'working', result: { phase: 'publishing', total: toPublish.length } });
      const today0 = new Date().toISOString().slice(0, 10);
      const pubd = [];
      for (const p of toPublish) {
        const row = draftBy[p.id];
        const slug = row.slug;
        // The body links to this exact reserved URL. If the slug got taken since Prepare we must
        // NOT silently change it (that breaks the in-body links) — tell Karen to re-prepare.
        const taken = await slugExists({ brand: blog, slug, pit: PIT });
        if (taken === true) { await finish({ status: 'error', error: `The URL "/${slug}" was taken since you prepared this cluster — re-run Prepare to refresh the links, then publish.` }); return json(200, {}); }
        const draft = { body_html: row.body_html, meta_title: row.meta_title, meta_description: row.meta_description, slug, category: row.category, internal_links: row.internal_links, assets: row.assets || {} };
        const r = await createBlogPost({ brand: blog, post: p, draft, pit: PIT, status: 'PUBLISHED', imageAltText: (row.assets && row.assets.title) || p.primary_keyword });
        await rest(`posts?id=eq.${p.id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ ghl_post_id: r.id, url: r.url, status: 'live', published_date: today0, scheduled_date: today0, confirmed_live: true, indexed: 'requested', current_step: 5 }) });
        try { await requestIndexing(r.url); } catch {}
        try { await syncInternalLinks({ supabaseUrl: SUPABASE_URL, headers: h, postId: p.id, brand: blog, bodyHtml: draft.body_html }); } catch {}
        if (GH_TOKEN) { try { await fetch('https://api.github.com/repos/escapepreneur/blog-tracker/dispatches', { method: 'POST', headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: 'application/vnd.github+json', 'content-type': 'application/json' }, body: JSON.stringify({ event_type: 'render-featured', client_payload: { post_id: p.id } }) }); } catch {} }
        pubd.push({ title: (row.assets && row.assets.title) || p.title, url: r.url, is_pillar: !!p.is_pillar });
      }
      await finish({ status: 'done', result: { cluster, published: pubd, count: pubd.length, already_live: alreadyLive.length, mode: 'publish_prepared' } });
      return json(200, { ok: true, published: pubd.length });
    }

    // 2. Reserve a unique slug/URL for each post to publish (verify against GHL + the batch).
    const used = new Set(alreadyLive.map(p => (p.url || '').split('/').pop()).filter(Boolean));
    for (const p of toPublish) {
      let base = slugify(p.title || p.primary_keyword), slug = base, n = 1;
      // avoid collisions within this batch and against existing GHL posts
      while (used.has(slug) || (await slugExists({ brand: blog, slug, pit: PIT })) === true) { n++; slug = `${base}-${n}`; if (n > 20) break; }
      used.add(slug);
      p._slug = slug; p._url = publicUrl(blog, slug);
    }

    // 3. Build the full cluster link map (already-live + reserved) for interlinking.
    const clusterLinks = [
      ...alreadyLive.map(p => ({ title: p.title || p.primary_keyword, url: p.url, is_pillar: !!p.is_pillar })),
      ...toPublish.map(p => ({ title: p.title || p.primary_keyword, url: p._url, is_pillar: !!p.is_pillar })),
    ];
    // Live posts (any) for non-cluster internal-link candidates.
    const live = await (await rest(`posts?blog=eq.${blog}&status=eq.live&url=not.is.null&select=title,primary_keyword,url,cluster,is_pillar`)).json();
    const liveLinks = live.map(p => ({ title: p.title || p.primary_keyword, url: p.url, cluster: p.cluster || null, is_pillar: !!p.is_pillar }));

    await finish({ status: 'working', result: { phase: 'generating', total: toPublish.length } });

    // 4. Generate each post with the full cluster map (capped concurrency).
    const generated = await pool(toPublish, CONCURRENCY, async (p) => {
      try {
        const postCtx = { ...p, _selfUrl: p._url };
        const gen = await generateDraft({ post: postCtx, brand: blog, liveLinks, clusterLinks, anthropicKey: AKEY });
        const { draft } = await autoFix({ draft: gen.draft, anthropicKey: AKEY });
        draft.slug = p._slug; // force the reserved slug so the URL is exactly what we linked to
        const report = runChecks({ brand: blog, post: p, draft });
        let bodyImages = [];
        if (PEXELS && Array.isArray(draft.body_image_searches)) {
          for (const term of draft.body_image_searches.slice(0, 4)) {
            bodyImages.push({ term, candidates: await searchPexels(term, PEXELS, 3), chosen: null });
          }
        }
        const row = {
          post_id: p.id, body_html: draft.body_html, meta_title: draft.meta_title, meta_description: draft.meta_description,
          slug: draft.slug, category: draft.category, internal_links: draft.internal_links,
          assets: {
            canva_title: draft.canva_title, canva_subtitle: draft.canva_subtitle, body_image_searches: draft.body_image_searches,
            facebook_caption: draft.facebook_caption, instagram_caption: draft.instagram_caption, pinterest_description: draft.pinterest_description,
            faq: draft.faq, title: draft.title, body_images: bodyImages,
            featured_title: draft.featured_title, featured_tagline: draft.featured_tagline, featured_image_search: draft.featured_image_search,
            cta_choice: draft.cta_choice,
          },
          check_report: report, model: gen.model, generated_at: new Date().toISOString(),
        };
        await rest('post_drafts?on_conflict=post_id', { method: 'POST', headers: { ...h, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(row) });
        // Match the single-post generate flow: a saved draft advances idea -> drafted so the
        // tracker reflects reality (Prepare was leaving these stuck showing "Idea").
        if (['idea', 'drafted'].includes(p.status)) {
          await rest(`posts?id=eq.${p.id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'drafted', current_step: Math.max(p.current_step || 0, 2) }) });
        }
        return { post: p, draft, report, ok: report.verdict !== 'fail' };
      } catch (e) { return { post: p, error: String(e && e.message || e), ok: false }; }
    });

    const ok = generated.filter(g => g.ok);
    const failed = generated.filter(g => !g.ok);

    // Dispatch the featured-image render for every successfully-generated post — the single-post
    // generate flow already does this, but Prepare (dry_run) never did, so every prepared cluster
    // post sat with a featured_image_search set and no image until something else triggered one.
    if (GH_TOKEN) {
      for (const g of ok) {
        try { await fetch('https://api.github.com/repos/escapepreneur/blog-tracker/dispatches', { method: 'POST', headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: 'application/vnd.github+json', 'content-type': 'application/json' }, body: JSON.stringify({ event_type: 'render-featured', client_payload: { post_id: g.post.id } }) }); } catch {}
      }
    }

    // 5. Dry run (Prepare) ALWAYS completes — drafts are already saved and nothing publishes,
    //    so one failing post shouldn't hide the rest. Report which need fixing; the hard gate
    //    that blocks a broken cluster lives on the actual publish paths (below + publish_prepared).
    if (dry_run) {
      await finish({ status: 'done', result: { dry_run: true, cluster,
        would_publish: ok.map(g => ({ title: g.draft.title || g.post.title, slug: g.post._slug, url: g.post._url, is_pillar: !!g.post.is_pillar, verdict: g.report.verdict, internal_links: (g.draft.internal_links || []).length })),
        needs_fixing: failed.map(f => ({ title: f.post.title || f.post.primary_keyword, reason: f.error || ((f.report && f.report.hard || []).join('; ')) || 'must-fix issues' })),
        ready: ok.length, total: generated.length, already_live: alreadyLive.length } });
      return json(200, {});
    }

    // One-shot Launch: don't mass-publish a broken cluster — surface what failed and stop.
    if (failed.length) {
      await finish({ status: 'error', error: `${failed.length} of ${toPublish.length} posts failed generation/checks — fix these before launching: ` + failed.map(f => `"${(f.post.title || f.post.primary_keyword)}"${f.error ? ` (${f.error})` : ' (must-fix issues)'}`).join('; ') });
      return json(200, {});
    }

    // 6. Publish all (body is final at create time, so links are baked in).
    await finish({ status: 'working', result: { phase: 'publishing', total: generated.length } });
    const today = new Date().toISOString().slice(0, 10);
    const published = [];
    for (const g of generated) {
      const p = g.post, draft = g.draft;
      const r = await createBlogPost({
        brand: blog, post: p, draft, pit: PIT, status: 'PUBLISHED',
        imageUrl: undefined, imageAltText: draft.title || p.primary_keyword,
      });
      await rest(`posts?id=eq.${p.id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ ghl_post_id: r.id, url: r.url, status: 'live', published_date: today, scheduled_date: today, confirmed_live: true, indexed: 'requested', current_step: 5 }) });
      try { await requestIndexing(r.url); } catch {}
      try { await syncInternalLinks({ supabaseUrl: SUPABASE_URL, headers: h, postId: p.id, brand: blog, bodyHtml: draft.body_html }); } catch {}
      if (GH_TOKEN) { try { await fetch('https://api.github.com/repos/escapepreneur/blog-tracker/dispatches', { method: 'POST', headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: 'application/vnd.github+json', 'content-type': 'application/json' }, body: JSON.stringify({ event_type: 'render-featured', client_payload: { post_id: p.id } }) }); } catch {} }
      published.push({ title: draft.title || p.title, url: r.url, is_pillar: !!p.is_pillar });
    }

    await finish({ status: 'done', result: { cluster, published, count: published.length, already_live: alreadyLive.length } });
    return json(200, { ok: true, published: published.length });
  } catch (e) {
    await finish({ status: 'error', error: String(e && e.message || e) });
    return json(502, { error: String(e && e.message || e) });
  }
};
