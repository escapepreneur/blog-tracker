// Local harness to validate draft generation + checking on a real post,
// without deploying anything. Prints the draft and the check report.
//   ANTHROPIC_API_KEY=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/test-generate.mjs <post_id> [--save]
import { generateDraft } from '../netlify/functions/_lib/generate.mjs';
import { runChecks } from '../netlify/functions/_lib/checker.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpprrknnkjyluhgtoezu.supabase.co';
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AKEY = process.env.ANTHROPIC_API_KEY;
const postId = process.argv[2];
const SAVE = process.argv.includes('--save');
if (!SKEY || !AKEY) { console.error('Need SUPABASE_SERVICE_ROLE_KEY and ANTHROPIC_API_KEY'); process.exit(1); }
if (!postId) { console.error('Usage: node scripts/test-generate.mjs <post_id> [--save]'); process.exit(1); }

const h = { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'content-type': 'application/json' };
const rest = (q) => fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: h }).then(r => r.json());

const [post] = await rest(`posts?id=eq.${postId}&select=*`);
if (!post) { console.error('post not found'); process.exit(1); }
const brand = post.blog;
const live = await rest(`posts?blog=eq.${brand}&status=eq.live&url=not.is.null&select=title,primary_keyword,url`);
const liveLinks = live.map(p => ({ title: p.title || p.primary_keyword, url: p.url }));

console.log(`\n=== GENERATING: [${brand}] "${post.primary_keyword}" (${liveLinks.length} internal-link candidates) ===\n`);
const t0 = Date.now();
const { draft, usage, model } = await generateDraft({ post, brand, liveLinks, anthropicKey: AKEY });
console.log(`model=${model}  tokens in/out=${usage?.input_tokens}/${usage?.output_tokens}  ${(Date.now()-t0)/1000}s\n`);

console.log('TITLE (H1):', draft.title);
console.log('META TITLE:', `(${(draft.meta_title||'').length}) ${draft.meta_title}`);
console.log('META DESC :', `(${(draft.meta_description||'').length}) ${draft.meta_description}`);
console.log('SLUG      :', draft.slug);
console.log('CATEGORY  :', draft.category);
console.log('INTERNAL  :', JSON.stringify(draft.internal_links, null, 0));
console.log('CANVA     :', draft.canva_title, '/', draft.canva_subtitle);
console.log('IMG SEARCH:', JSON.stringify(draft.body_image_searches));
console.log('\n----- BODY HTML -----\n');
console.log(draft.body_html);

const report = runChecks({ brand, post, draft });
console.log('\n===== CHECK REPORT =====');
console.log('VERDICT:', report.verdict.toUpperCase(), '| words:', report.wordCount);
if (report.hard.length) console.log('\nHARD FAILS:\n - ' + report.hard.join('\n - '));
if (report.warn.length) console.log('\nWARNINGS:\n - ' + report.warn.join('\n - '));
console.log('\nPASSED:\n - ' + report.pass.join('\n - '));

if (SAVE) {
  const row = {
    post_id: postId, body_html: draft.body_html, meta_title: draft.meta_title,
    meta_description: draft.meta_description, slug: draft.slug, category: draft.category,
    internal_links: draft.internal_links,
    assets: { canva_title: draft.canva_title, canva_subtitle: draft.canva_subtitle, body_image_searches: draft.body_image_searches, facebook_caption: draft.facebook_caption, instagram_caption: draft.instagram_caption, pinterest_description: draft.pinterest_description },
    check_report: report, model, generated_at: new Date().toISOString(),
  };
  const r = await fetch(`${SUPABASE_URL}/rest/v1/post_drafts?on_conflict=post_id`, {
    method: 'POST', headers: { ...h, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(row),
  });
  console.log('\nsaved to post_drafts:', r.status);
}
