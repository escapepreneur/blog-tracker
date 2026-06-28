// POST { post_id, instruction } -> Claude revises the draft per the instruction,
// auto-fixes voice slips, re-runs the checker, saves. Background fn (rewrite takes >10s);
// the dashboard polls post_drafts.generated_at for the update.
import { reviseDraft } from './_lib/aiedit.mjs';
import { autoFix } from './_lib/brandguard.mjs';
import { runChecks } from './_lib/checker.mjs';
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
  const { post_id, instruction } = body;
  if (!post_id || !instruction) return json(400, { error: 'post_id and instruction required' });

  const h = { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'content-type': 'application/json' };
  const rest = (q, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: h, ...opts });

  try {
    const [post] = await (await rest(`posts?id=eq.${post_id}&select=*`)).json();
    const [draft] = await (await rest(`post_drafts?post_id=eq.${post_id}&select=*`)).json();
    if (!post || !draft) return json(404, { error: 'post or draft not found' });

    const rev = await reviseDraft({ post, draft, instruction, anthropicKey: AKEY });
    const { draft: clean } = await autoFix({ draft: rev, anthropicKey: AKEY });

    const checkDraft = {
      title: clean.title, body_html: clean.body_html, meta_title: clean.meta_title,
      meta_description: clean.meta_description, slug: draft.slug, category: draft.category,
      internal_links: draft.internal_links,
    };
    const report = runChecks({ brand: post.blog, post, draft: checkDraft });

    const assets = { ...(draft.assets || {}), title: clean.title };
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
