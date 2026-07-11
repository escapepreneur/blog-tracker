// GHL blog publishing. Reuses the proven write path from the Software Updates build.
// API host services.leadconnectorhq.com, Version 2021-07-28, Bearer PIT.
import { BRANDS } from './brands.mjs';
import { embedBodyImages } from './embedimages.mjs';
import { affiliateLinkify } from './affiliate.mjs';

const GHL = 'https://services.leadconnectorhq.com';
const LOC = process.env.GHL_LOCATION_ID || 'EoD3KT6IiKx0oIXjInOt';

function pickCategoryId(brand, label, post = {}) {
  const cats = BRANDS[brand].categories || [];
  if (!cats.length) return undefined;
  const L = String(label || '').toLowerCase();
  let m = cats.find(c => c.label.toLowerCase() === L);
  if (!m) {
    const hay = `${label || ''} ${post.title || ''} ${post.primary_keyword || ''}`.toLowerCase();
    m = cats.find(c => hay.includes(c.label.toLowerCase()));
  }
  return (m || cats[0]).id;
}

export function publicUrl(brand, slug) {
  return 'https://' + BRANDS[brand].postUrl.replace('[slug]', slug);
}

export function slugify(s) {
  return String(s || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'post';
}

// Is a urlSlug already taken on this blog? Returns true/false, or null if the check
// endpoint is unavailable (caller decides how cautious to be).
export async function slugExists({ brand, slug, pit }) {
  const b = BRANDS[brand];
  const u = `${GHL}/blogs/posts/url-slug-exists?locationId=${LOC}&urlSlug=${encodeURIComponent(slug)}&blogId=${b.blogId}`;
  try {
    const res = await fetch(u, { headers: { Authorization: `Bearer ${pit}`, Version: '2021-07-28' } });
    if (!res.ok) return null;
    const d = await res.json().catch(() => ({}));
    return !!(d.exists ?? d.exist ?? (d.data && d.data.exists));
  } catch { return null; }
}

// Create a blog post in GHL. status DRAFT (default) or PUBLISHED.
// GHL only sets the body at CREATE time (PUT can't change rawHTML) — so the body must be final here.
export async function createBlogPost({ brand, post, draft, pit, status = 'DRAFT', publishedAt, imageUrl, imageAltText }) {
  const b = BRANDS[brand];
  const title = (draft.assets && draft.assets.title) || post.title || post.primary_keyword;
  let rawHTML = affiliateLinkify(embedBodyImages(draft.body_html, draft.assets && draft.assets.body_images));
  // Embed the Pinterest pin near the end (a "save this" graphic). Body is final at create
  // time, so it must be baked in here. Inline styles only — GHL strips classes.
  const pinUrl = draft.assets && draft.assets.pin_image_url;
  if (pinUrl) {
    const alt = String(title).replace(/"/g, '&quot;');
    rawHTML += `<div style="max-width:300px;margin:32px auto;text-align:center"><img src="${pinUrl}" alt="${alt}" style="display:block;width:100%;height:auto;border-radius:10px"></div>`;
  }
  const payload = {
    title,
    locationId: LOC,
    blogId: b.blogId,
    rawHTML,
    status,
    categories: [pickCategoryId(brand, draft.category, post)].filter(Boolean),
    author: b.authorId,
    urlSlug: draft.slug,
    description: draft.meta_description,
    publishedAt: publishedAt || new Date().toISOString(),
  };
  if (imageUrl) { payload.imageUrl = imageUrl; payload.imageAltText = imageAltText || title; }
  const res = await fetch(`${GHL}/blogs/posts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${pit}`, Version: '2021-07-28', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`GHL create ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  const created = data.blogPost || data.data || data;
  return { id: created._id || created.id, slug: created.urlSlug || draft.slug, url: publicUrl(brand, created.urlSlug || draft.slug), raw: created };
}

// Flip an existing GHL post to PUBLISHED (used by the scheduled go-live cron).
export async function publishBlogPost({ ghlPostId, pit, brand, imageUrl, imageAltText }) {
  const body = { status: 'PUBLISHED', locationId: LOC, blogId: BRANDS[brand] && BRANDS[brand].blogId };
  if (imageUrl) { body.imageUrl = imageUrl; body.imageAltText = imageAltText || ''; }
  const res = await fetch(`${GHL}/blogs/posts/${ghlPostId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${pit}`, Version: '2021-07-28', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GHL publish ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return true;
}

// Update just the featured image on an existing GHL post (keeps its current status,
// so a live post stays live and a draft stays a draft). PUT only touches the fields
// sent; body/title/slug are left as-is.
export async function updatePostImage({ ghlPostId, pit, brand, status = 'PUBLISHED', imageUrl, imageAltText }) {
  const body = { status, locationId: LOC, blogId: BRANDS[brand] && BRANDS[brand].blogId, imageUrl, imageAltText: imageAltText || '' };
  const res = await fetch(`${GHL}/blogs/posts/${ghlPostId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${pit}`, Version: '2021-07-28', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GHL update image ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return true;
}

// Read a post's full detail incl. rawHTML (needs blog READ scope). GET /blogs/posts/{id}.
export async function getBlogPostDetail({ ghlPostId, pit }) {
  const r = await fetch(`${GHL}/blogs/posts/${ghlPostId}?locationId=${LOC}`, { headers: { Authorization: `Bearer ${pit}`, Version: '2021-07-28' } });
  if (!r.ok) throw new Error(`GHL detail ${r.status}: ${(await r.text()).slice(0, 150)}`);
  const d = await r.json().catch(() => ({}));
  return d.blogPost || d.data || d;
}

// Find a post by urlSlug on the brand's blog (for imported posts with no stored id).
// Returns the post object (incl. _id) or null. Needs blog READ scope.
export async function getBlogPostBySlug({ brand, slug, pit }) {
  const b = BRANDS[brand];
  const want = String(slug || '').replace(/^\/+|\/+$/g, '').toLowerCase();
  // GHL's list endpoint needs a status filter; live posts are PUBLISHED (fall back to
  // the other statuses so we can also find scheduled/draft posts if ever needed).
  for (const status of ['PUBLISHED', 'SCHEDULED', 'DRAFT']) {
    for (let offset = 0; offset < 1000; offset += 50) {
      const r = await fetch(`${GHL}/blogs/posts/all?locationId=${LOC}&blogId=${b.blogId}&status=${status}&limit=50&offset=${offset}`, { headers: { Authorization: `Bearer ${pit}`, Version: '2021-07-28' } });
      if (!r.ok) throw new Error(`GHL bySlug ${r.status}: ${(await r.text()).slice(0, 150)}`);
      const d = await r.json().catch(() => ({}));
      const list = d.blogs || d.data || [];
      const m = list.find(p => String(p.urlSlug || '').toLowerCase() === want);
      if (m) return m;
      if (list.length < 50) break;
    }
  }
  return null;
}

// Update TITLE + META DESCRIPTION on an existing post, in place. GHL's PUT can change
// title/description/imageUrl but IGNORES rawHTML (body is locked at create) — verified
// 2026-07-10. Sends the full current object with the new title/description so nothing
// else is wiped. `current` = the object from getBlogPostDetail.
export async function updateBlogPost({ ghlPostId, brand, pit, current = {}, title, description }) {
  const b = BRANDS[brand];
  const payload = {
    title: title != null ? title : current.title,
    locationId: LOC, blogId: b.blogId,
    rawHTML: current.rawHTML || '',            // ignored by GHL; included to keep the payload complete
    status: current.status || 'PUBLISHED',
    urlSlug: current.urlSlug,
    description: description != null ? description : current.description,
    imageUrl: current.imageUrl || '',
    imageAltText: current.imageAltText || '',
    categories: (current.categories || []).map(c => c._id || c.id || c),
    author: current.author || b.authorId,
    publishedAt: current.publishedAt || new Date().toISOString(),
  };
  const r = await fetch(`${GHL}/blogs/posts/${ghlPostId}`, {
    method: 'PUT', headers: { Authorization: `Bearer ${pit}`, Version: '2021-07-28', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`GHL update ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return true;
}

// Upload an image buffer to the GHL media library -> { fileId, url }.
export async function uploadMedia({ buffer, filename = 'featured.jpg', contentType = 'image/jpeg', pit }) {
  const fd = new FormData();
  fd.append('file', new Blob([buffer], { type: contentType }), filename);
  fd.append('hosted', 'false');
  const res = await fetch(`${GHL}/medias/upload-file`, {
    method: 'POST', headers: { Authorization: `Bearer ${pit}`, Version: '2021-07-28' }, body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`GHL media ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
  return { fileId: data.fileId || data._id, url: data.url };
}
