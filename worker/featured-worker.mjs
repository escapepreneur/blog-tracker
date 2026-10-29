// Renders + uploads a featured image for drafts that need one.
// Run in GitHub Actions. env: SUPABASE_SERVICE_ROLE_KEY, PEXELS_API_KEY, GHL_API_TOKEN.
// Optional argv[2] = a single post_id (from repository_dispatch); otherwise processes all pending.
import { searchPexels } from '../netlify/functions/_lib/pexels.mjs';
import { uploadMedia, updatePostImage } from '../netlify/functions/_lib/ghl.mjs';
import { renderFeatured } from './render-featured.mjs';

const SUPA = process.env.SUPABASE_URL || 'https://vpprrknnkjyluhgtoezu.supabase.co';
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PEXELS = process.env.PEXELS_API_KEY;
const PIT = process.env.GHL_API_TOKEN;
const ONLY = (process.argv[2] || '').trim() || null;
if (!SKEY || !PEXELS || !PIT) { console.error('missing SUPABASE_SERVICE_ROLE_KEY / PEXELS_API_KEY / GHL_API_TOKEN'); process.exit(1); }

const h = { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'content-type': 'application/json' };
const rest = (q, opts = {}) => fetch(`${SUPA}/rest/v1/${q}`, { headers: h, ...opts });

async function getPending() {
  const rows = await (await rest('post_drafts?select=post_id,assets')).json();
  return rows.filter(r => {
    if (ONLY && r.post_id !== ONLY) return false;
    const a = r.assets || {};
    return a.featured_image_search && !a.featured_image_url;
  });
}

// Every already-used featured background, blogwide (live + drafted) — so the auto-picker
// below stops handing out the same top Pexels result to every post that happens to share
// a similar search term (this is exactly how a cluster like "Vision Board" ended up with
// the same photo on several posts: same term -> same #1 result -> same image, every time).
async function getUsedBgUrls() {
  const rows = await (await rest('post_drafts?select=assets')).json();
  const used = new Set();
  for (const r of (rows || [])) {
    const u = r.assets && r.assets.featured_bg_url;
    if (u) used.add(u);
  }
  return used;
}

async function processOne(row, usedBg) {
  const [post] = await (await rest(`posts?id=eq.${row.post_id}&select=blog,status,ghl_post_id,title,primary_keyword,subtitle`)).json();
  const brand = (post && post.blog) || 'esc'; // selects the per-brand logo (esc / nms)
  const a = row.assets || {};
  const tagline = (post && post.subtitle) || a.featured_tagline || ''; // subtitle is the master
  let bgUrl = a.featured_bg_url; // an explicit pick from the candidate grid takes priority
  if (!bgUrl) {
    const term = a.featured_image_search;
    let cands = await searchPexels(term, PEXELS, 8);
    if (!cands.length) { console.log('  no Pexels results for:', term); return; }
    let pick = cands.find(c => c.url && !usedBg.has(c.url));
    if (!pick) { // first page is all taken -> try a second page before giving up on variety
      const more = await searchPexels(term, PEXELS, 8, 2);
      pick = more.find(c => c.url && !usedBg.has(c.url));
      if (pick) cands = more;
    }
    if (!pick) {
      console.log('  every candidate for "' + term + '" is already used elsewhere — reusing the closest match');
      const idx = a.featured_bg_index || 0;
      pick = cands[idx % cands.length];
    }
    bgUrl = pick.url;
  }
  usedBg.add(bgUrl); // claim it immediately so the next post processed THIS run can't also pick it
  const bg = Buffer.from(await (await fetch(bgUrl)).arrayBuffer()).toString('base64');
  const jpeg = await renderFeatured({ title: a.featured_title || '', tagline, bgBase64: bg, brand });
  const up = await uploadMedia({ buffer: jpeg, filename: `featured-${row.post_id}.jpg`, pit: PIT });
  const assets = { ...a, featured_image_url: up.url, featured_bg_url: bgUrl };

  await rest(`post_drafts?post_id=eq.${row.post_id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ assets }) });
  console.log('  featured ✓', row.post_id, '->', up.url);

  // If this post is already in GHL, push the new image onto it (keeping its status)
  // so re-render/swap updates a live or scheduled post without a full republish.
  // EXCEPT when featured_review is set: that's a preview the user must approve first.
  if (post && post.ghl_post_id && !a.featured_review) {
    const ghlStatus = post.status === 'live' ? 'PUBLISHED' : 'DRAFT';
    try {
      await updatePostImage({ ghlPostId: post.ghl_post_id, pit: PIT, brand, status: ghlStatus, imageUrl: up.url, imageAltText: a.featured_title || post.title || post.primary_keyword });
      console.log('  updated GHL post image', post.ghl_post_id, `(${ghlStatus})`);
    } catch (e) { console.error('  GHL image update failed', post.ghl_post_id, e.message); }
  }
}

const pending = await getPending();
const usedBg = await getUsedBgUrls();
console.log(`${pending.length} draft(s) need a featured image${ONLY ? ` (post ${ONLY})` : ''}`);
for (const r of pending) { try { await processOne(r, usedBg); } catch (e) { console.error('  FAIL', r.post_id, e.message); } }
console.log('done');
