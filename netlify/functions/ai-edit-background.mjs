// POST { post_id, instruction } -> Claude revises the draft per the instruction,
// auto-fixes voice slips, re-runs the checker, saves. Background fn (rewrite takes >10s);
// the dashboard polls post_drafts.generated_at for the update.
import { reviseDraft } from './_lib/aiedit.mjs';
import { autoFix } from './_lib/brandguard.mjs';
import { runChecks, leadMagnetUse } from './_lib/checker.mjs';
import { BRANDS } from './_lib/brands.mjs';
import { syncInternalLinks } from './_lib/links.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpprrknnkjyluhgtoezu.supabase.co';
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AKEY = process.env.ANTHROPIC_API_KEY;
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  if (!SKEY || !AKEY) return json(500, { error: 'Server not configured.' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'invalid JSON' }); }
  // Either a free-text instruction, or cta_choice (a lead-magnet key): switch the article's
  // closing link to that resource and set the "Matched CTA link" field to match.
  const { post_id, instruction, cta_choice } = body;
  if (!post_id || (!instruction && !cta_choice)) return json(400, { error: 'post_id and an instruction or cta_choice required' });

  const h = { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'content-type': 'application/json' };
  const rest = (q, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: h, ...opts });

  try {
    const [post] = await (await rest(`posts?id=eq.${post_id}&select=*`)).json();
    const [draft] = await (await rest(`post_drafts?post_id=eq.${post_id}&select=*`)).json();
    if (!post || !draft) return json(404, { error: 'post or draft not found' });

    let ctaKey = (draft.assets || {}).cta_choice || null;
    let instr = instruction;
    if (cta_choice) {
      const magnets = (BRANDS[post.blog] && BRANDS[post.blog].leadMagnets) || [];
      const magnet = magnets.find(m => m.key === cta_choice);
      if (!magnet) return json(400, { error: `Unknown CTA "${cta_choice}" for this blog.` });
      ctaKey = magnet.key;
      const use = leadMagnetUse(post.blog, draft.body_html || '');
      const alreadyMatches = use.keys.length === 1 && use.keys[0] === magnet.key;
      const others = magnets.filter(m => m.key !== magnet.key).map(m => `${m.label} (${m.url})`);
      // If the article already links only to this resource, just the field changes. Otherwise
      // rewrite the closing paragraph so the field and the article agree.
      instr = alreadyMatches ? null
        : `Change the closing paragraph (the last paragraph of the article, after the FAQ) so that it contains exactly ONE in-text link, an <a href="${magnet.url}"> link to ${magnet.label}, with descriptive anchor text, and reads naturally as the reader's next step. Make sure no other link in the article points to ${others.length ? others.join(' or ') : 'another lead-magnet resource'}. Keep the tone and length of the closing paragraph and change nothing else in the article.`;
    }

    let clean;
    if (instr) {
      const rev = await reviseDraft({ post, draft, instruction: instr, anthropicKey: AKEY });
      ({ draft: clean } = await autoFix({ draft: rev, anthropicKey: AKEY }));
    } else {
      const a0 = draft.assets || {};
      clean = { title: a0.title, body_html: draft.body_html, meta_title: draft.meta_title, meta_description: draft.meta_description };
    }

    const checkDraft = {
      title: clean.title, body_html: clean.body_html, meta_title: clean.meta_title,
      meta_description: clean.meta_description, slug: draft.slug, category: draft.category,
      internal_links: draft.internal_links, cta_choice: ctaKey,
    };
    const report = runChecks({ brand: post.blog, post, draft: checkDraft });

    const assets = { ...(draft.assets || {}), title: clean.title };
    if (ctaKey) assets.cta_choice = ctaKey;
    await rest(`post_drafts?post_id=eq.${post_id}`, {
      method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' },
      body: JSON.stringify({
        body_html: clean.body_html, meta_title: clean.meta_title, meta_description: clean.meta_description,
        assets, check_report: report, generated_at: new Date().toISOString(),
      }),
    });
    try { await syncInternalLinks({ supabaseUrl: SUPABASE_URL, headers: h, postId: post_id, brand: post.blog, bodyHtml: clean.body_html }); } catch (e) { /* best-effort */ }
    return json(200, { ok: true, verdict: report.verdict });
  } catch (e) {
    return json(500, { error: String(e && e.message || e) });
  }
};
