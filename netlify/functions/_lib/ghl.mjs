// GHL blog publishing. Reuses the proven write path from the Software Updates build.
// API host services.leadconnectorhq.com, Version 2021-07-28, Bearer PIT.
import { BRANDS } from './brands.mjs';
import { embedBodyImages } from './embedimages.mjs';
import { styleCta } from './cta.mjs';

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

// Create a blog post in GHL. status DRAFT (default) or PUBLISHED.
// GHL only sets the body at CREATE time (PUT can't change rawHTML) — so the body must be final here.
export async function createBlogPost({ brand, post, draft, pit, status = 'DRAFT', publishedAt, imageUrl, imageAltText }) {
  const b = BRANDS[brand];
  const title = (draft.assets && draft.assets.title) || post.title || post.primary_keyword;
  const payload = {
    title,
    locationId: LOC,
    blogId: b.blogId,
    rawHTML: styleCta(embedBodyImages(draft.body_html, draft.assets && draft.assets.body_images), brand),
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
