// Renders + uploads a featured image for drafts that need one.
// Run in GitHub Actions. env: SUPABASE_SERVICE_ROLE_KEY, PEXELS_API_KEY, GHL_API_TOKEN.
// Optional argv[2] = a single post_id (from repository_dispatch); otherwise processes all pending.
import { searchPexels } from '../netlify/functions/_lib/pexels.mjs';
import { uploadMedia, updatePostImage } from '../netlify/functions/_lib/ghl.mjs';
import { renderFeatured } from './render-featured.mjs';
import { renderPin } from './render-pin.mjs';

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

async function processOne(row) {
  const [post] = await (await rest(`posts?id=eq.${row.post_id}&select=blog,status,ghl_post_id,title,primary_keyword`)).json();
  const brand = (post && post.blog) || 'esc'; // selects the per-brand logo (esc / nms)
  const a = row.assets || {};
  const term = a.featured_image_search;
  const idx = a.featured_bg_index || 0;
  const cands = await searchPexels(term, PEXELS, 5);
  if (!cands.length) { console.log('  no Pexels results for:', term); return; }
  const pick = cands[idx % cands.length];
  const bg = Buffer.from(await (await fetch(pick.url)).arrayBuffer()).toString('base64');
  const jpeg = await renderFeatured({ title: a.featured_title || '', tagline: a.featured_tagline || '', bgBase64: bg, brand });
  const up = await uploadMedia({ buffer: jpeg, filename: `featured-${row.post_id}.jpg`, pit: PIT });
  const assets = { ...a, featured_image_url: up.url, featured_bg_index: idx };

  // Pinterest pin (1000x1500, same bg + title) — stored for in-body embed + Pinterest posting.
  if (!a.pin_image_url) {
    try {
      const pinJpeg = await renderPin({ title: a.featured_title || '', tagline: a.featured_tagline || '', bgBase64: bg, brand });
      const pinUp = await uploadMedia({ buffer: pinJpeg, filename: `pin-${row.post_id}.jpg`, pit: PIT });
      assets.pin_image_url = pinUp.url;
      console.log('  pin ✓', row.post_id, '->', pinUp.url);
    } catch (e) { console.error('  pin render failed', row.post_id, e.message); }
  }
  await rest(`post_drafts?post_id=eq.${row.post_id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ assets }) });
  console.log('  featured ✓', row.post_id, '->', up.url);

  // If this post is already in GHL, push the new image onto it (keeping its status)
  // so re-render/swap updates a live or scheduled post without a full republish.
  if (post && post.ghl_post_id) {
    const ghlStatus = post.status === 'live' ? 'PUBLISHED' : 'DRAFT';
    try {
      await updatePostImage({ ghlPostId: post.ghl_post_id, pit: PIT, brand, status: ghlStatus, imageUrl: up.url, imageAltText: a.featured_title || post.title || post.primary_keyword });
      console.log('  updated GHL post image', post.ghl_post_id, `(${ghlStatus})`);
    } catch (e) { console.error('  GHL image update failed', post.ghl_post_id, e.message); }
  }
}

const pending = await getPending();
console.log(`${pending.length} draft(s) need a featured image${ONLY ? ` (post ${ONLY})` : ''}`);
for (const r of pending) { try { await processOne(r); } catch (e) { console.error('  FAIL', r.post_id, e.message); } }
console.log('done');
