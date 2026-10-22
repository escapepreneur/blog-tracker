#!/usr/bin/env node
// set-canonical: give live ESC Hub / No More Somedays posts a self-referencing canonical
// address, without touching the body. Posts built through the tool never had one, so Google
// had to guess, and collapsed unrelated posts into each other as "duplicates".
//   node scripts/set-canonical.mjs <brand> <slug> [<slug> ...] [--dry]
//   node scripts/set-canonical.mjs <brand> all [--dry]      (every live post in the tracker)
//   env: SUPABASE_SERVICE_ROLE_KEY, GHL_API_TOKEN
import { getBlogPostDetail, getBlogPostBySlug, updateBlogPost, publicUrl } from '../netlify/functions/_lib/ghl.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpprrknnkjyluhgtoezu.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PIT = process.env.GHL_API_TOKEN;
if (!KEY || !PIT) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY or GHL_API_TOKEN'); process.exit(1); }

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
let [brand, ...slugs] = args.filter(a => !a.startsWith('--'));
if (!brand || !slugs.length) { console.error('usage: set-canonical.mjs <esc|nms> <slug> [<slug> ...] [--dry]'); process.exit(1); }

const h = { apikey: KEY, Authorization: `Bearer ${KEY}` };
let failures = 0;

if (slugs.length === 1 && slugs[0] === 'all') {
  const rows = await (await fetch(`${SUPABASE_URL}/rest/v1/posts?blog=eq.${brand}&status=eq.live&url=like.*/post/*&select=url&order=url&limit=1000`, { headers: h })).json();
  slugs = (Array.isArray(rows) ? rows : []).map(r => String(r.url).replace(/^.*\/post\//, '').replace(/[/?#].*$/, '')).filter(Boolean);
  console.log(`${slugs.length} live ${brand} posts`);
}

for (const slug of slugs) {
  const url = publicUrl(brand, slug);
  try {
    const [post] = await (await fetch(`${SUPABASE_URL}/rest/v1/posts?blog=eq.${brand}&url=eq.${encodeURIComponent(url)}&select=id,ghl_post_id`, { headers: h })).json();
    let ghlId = post && post.ghl_post_id;
    if (!ghlId) {
      const found = await getBlogPostBySlug({ brand, slug, pit: PIT });
      ghlId = found && (found._id || found.id);
    }
    if (!ghlId) { console.error(`FAIL  ${slug}: not found in the blog`); failures++; continue; }

    const before = await getBlogPostDetail({ ghlPostId: ghlId, pit: PIT });
    const bodyLen = (before.rawHTML || '').length;
    console.log(`${slug}: canonicalLink now ${JSON.stringify(before.canonicalLink || null)}, body ${bodyLen} chars`);
    if (before.canonicalLink === url) { console.log('  already set, skipping'); continue; }
    if (DRY) { console.log(`  dry run, would set ${url}`); continue; }

    await updateBlogPost({ ghlPostId: ghlId, brand, pit: PIT, current: before, canonicalLink: url });

    const after = await getBlogPostDetail({ ghlPostId: ghlId, pit: PIT });
    const stored = after.canonicalLink === url;
    const bodyOk = (after.rawHTML || '').length === bodyLen;
    console.log(`  stored in ESC Hub: ${stored ? 'yes' : 'NO'} | body unchanged: ${bodyOk ? 'yes' : 'NO'}`);
    if (!stored || !bodyOk) { failures++; continue; }

    await new Promise(r => setTimeout(r, 4000));
    const html = await (await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; blog-tracker-audit)' } })).text();
    const tag = (html.match(/<link[^>]*rel="canonical"[^>]*>/) || [null])[0];
    console.log(`  live page canonical tag: ${tag || 'NOT YET VISIBLE (page may be cached)'}`);
  } catch (e) {
    console.error(`FAIL  ${slug}: ${e.message}`);
    failures++;
  }
}
if (failures) { console.error(`${failures} post(s) failed`); process.exit(1); }
