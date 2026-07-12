// Renders + uploads a featured image for drafts that need one.
// Run in GitHub Actions. env: SUPABASE_SERVICE_ROLE_KEY, PEXELS_API_KEY, GHL_API_TOKEN.
// Optional argv[2] = a single post_id (from repository_dispatch); otherwise processes all pending.
import { searchPexels } from '../netlify/functions/_lib/pexels.mjs';
import { uploadMedia, updatePostImage } from '../netlify/functions/_lib/ghl.mjs';
import { postPinsForPost, getGhlUserId } from '../netlify/functions/_lib/pinterest.mjs';
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
      const pinJpeg = await renderPin({ title: a.featured_title || '', tagline: a.featured_tagline || '', brand, seed: row.post_id });
      const pinUp = await uploadMedia({ buffer: pinJpeg, filename: `pin-${row.post_id}.jpg`, pit: PIT });
      assets.pin_image_url = pinUp.url;
      console.log('  pin ✓', row.post_id, '->', pinUp.url);
    } catch (e) { console.error('  pin render failed', row.post_id, e.message); }
  }
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

// PIN BACKFILL: render + pin every live post that was never pinned (older posts with no
// pin image). Renders a branded pin from the title (no Pexels needed), uploads it, and
// pins to the topic + blog board with the article link. Self-healing: a failure leaves
// pinterest_posted=false so a re-run retries it. Triggered via repository_dispatch with
// client_payload.post_id = "PIN_BACKFILL".
async function pinBackfill(limit) {
  const userId = await getGhlUserId(PIT);
  if (!userId) { console.error('pin-backfill: no GHL userId (cannot post)'); return; }
  let posts = await (await rest('posts?status=eq.live&pinterest_posted=eq.false&url=not.is.null&select=id,blog,title,primary_keyword,url,cluster&order=published_date.desc.nullslast')).json();
  posts = Array.isArray(posts) ? posts : [];
  const total = posts.length;
  if (limit && posts.length > limit) posts = posts.slice(0, limit);
  console.log(`pin-backfill: ${total} unpinned live post(s); processing ${posts.length} this run`);
  let done = 0, failed = 0;
  for (const p of (Array.isArray(posts) ? posts : [])) {
    const label = `[${p.blog}] ${p.title || p.primary_keyword || p.id}`;
    try {
      const [d] = await (await rest(`post_drafts?post_id=eq.${p.id}&select=assets,meta_description`)).json();
      let assets = (d && d.assets) || {};
      if (!assets.pin_image_url) {
        const pinJpeg = await renderPin({ title: p.title || p.primary_keyword || '', tagline: assets.featured_tagline || '', brand: p.blog, seed: p.id });
        const up = await uploadMedia({ buffer: pinJpeg, filename: `pin-${p.id}.jpg`, pit: PIT });
        assets = { ...assets, pin_image_url: up.url };
        const w = d
          ? await rest(`post_drafts?post_id=eq.${p.id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ assets }) })
          : await rest('post_drafts', { method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ post_id: p.id, assets }) });
        if (!w.ok) throw new Error(`save pin_image_url ${w.status}: ${(await w.text()).slice(0, 120)}`);
      }
      const draft = { assets, meta_description: (d && d.meta_description) || null };
      const res = await postPinsForPost({ pit: PIT, userId, brand: p.blog, post: p, draft });
      const ok = res.posted && res.posted.some(x => !x.error);
      if (ok) {
        await rest(`posts?id=eq.${p.id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ pinterest_posted: true }) });
        done++;
        console.log(`  pinned ${label} -> ${res.posted.map(x => x.board + (x.error ? ' ERR' : '')).join(', ')}`);
      } else { failed++; console.error(`  FAIL ${label}: ${res.skipped || JSON.stringify(res.posted)}`); }
    } catch (e) { failed++; console.error(`  FAIL ${label}: ${e.message}`); }
    await new Promise(r => setTimeout(r, 1500)); // throttle for Pinterest rate limits
  }
  console.log(`pin-backfill done: ${done} pinned, ${failed} failed`);
}

if (ONLY && ONLY.startsWith('PIN_BACKFILL')) {
  const lim = parseInt(ONLY.split(':')[1] || '', 10);
  await pinBackfill(Number.isFinite(lim) && lim > 0 ? lim : null);
} else {
  const pending = await getPending();
  console.log(`${pending.length} draft(s) need a featured image${ONLY ? ` (post ${ONLY})` : ''}`);
  for (const r of pending) { try { await processOne(r); } catch (e) { console.error('  FAIL', r.post_id, e.message); } }
}
console.log('done');
