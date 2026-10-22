// POST { post_id } -> re-run the mechanical checks on the draft as it is saved now, and
// store the new report. No AI and no regeneration, so it takes about a second. Use it after
// editing a draft (or after changing the CTA field) to refresh the check results.
import { runChecks } from './_lib/checker.mjs';
import { getRecentOpenings } from './_lib/openings.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpprrknnkjyluhgtoezu.supabase.co';
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  if (!SKEY) return json(500, { error: 'Server not configured (SUPABASE_SERVICE_ROLE_KEY).' });
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'invalid JSON' }); }
  const { post_id } = body;
  if (!post_id) return json(400, { error: 'post_id required' });

  const h = { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'content-type': 'application/json' };
  const rest = (q, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: h, ...opts });

  try {
    const [post] = await (await rest(`posts?id=eq.${post_id}&select=*`)).json();
    const [draft] = await (await rest(`post_drafts?post_id=eq.${post_id}&select=*`)).json();
    if (!post || !draft) return json(404, { error: 'post or draft not found' });

    const a = draft.assets || {};
    const openings = await getRecentOpenings({ supabaseUrl: SUPABASE_URL, headers: h, blog: post.blog, limit: 400, exclude: post_id });
    const report = runChecks({
      brand: post.blog, post, openings,
      draft: {
        title: a.title, body_html: draft.body_html, meta_title: draft.meta_title,
        meta_description: draft.meta_description, slug: draft.slug, category: draft.category,
        internal_links: draft.internal_links, cta_choice: a.cta_choice, assets: a,
      },
    });
    const w = await rest(`post_drafts?post_id=eq.${post_id}`, {
      method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ check_report: report }),
    });
    if (!w.ok) return json(500, { error: `could not save the new report: ${w.status}` });
    return json(200, { ok: true, verdict: report.verdict, hard: report.hard.length, warn: report.warn.length });
  } catch (e) {
    return json(500, { error: String(e && e.message || e) });
  }
};
