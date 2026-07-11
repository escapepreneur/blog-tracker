// TEMP one-off: can we reclaim a slug after archiving a post? (Decides whether a
// recreate-at-same-URL republish is viable.) Create A (PUBLISHED) -> archive A ->
// create B at the SAME slug -> report B's resulting slug. Archive both. Delete after use.
const GHL = 'https://services.leadconnectorhq.com';
const LOC = process.env.GHL_LOCATION_ID || 'EoD3KT6IiKx0oIXjInOt';
const PIT = process.env.GHL_API_TOKEN;
const BLOG = '35V2JGaHwBWLFjBg2Ghx';
const H = () => ({ Authorization: `Bearer ${PIT}`, Version: '2021-07-28', 'Content-Type': 'application/json' });
const j = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o, null, 2) });
const mk = (slug, marker, status) => ({ title: 'ZZ Slugtest DELETE ME', locationId: LOC, blogId: BLOG, rawHTML: `<p>${marker}</p>`, status, urlSlug: slug, description: 'slugtest', publishedAt: new Date().toISOString() });

export const handler = async () => {
  if (!PIT) return j(500, { error: 'no GHL_API_TOKEN' });
  const out = {}; const slug = 'zz-slugtest-' + Date.now().toString(36); out.slug = slug;
  const create = async (payload) => { const r = await fetch(`${GHL}/blogs/posts`, { method: 'POST', headers: H(), body: JSON.stringify(payload) }); const d = await r.json().catch(() => ({})); const p = d.blogPost || d.data || d; return { status: r.status, id: p._id || p.id, urlSlug: p.urlSlug, err: r.ok ? undefined : JSON.stringify(d).slice(0, 200) }; };
  const put = async (id, payload) => { const r = await fetch(`${GHL}/blogs/posts/${id}`, { method: 'PUT', headers: H(), body: JSON.stringify(payload) }); return { status: r.status }; };
  try {
    const A = await create(mk(slug, 'AAA-original', 'PUBLISHED')); out.createA = A;
    if (!A.id) return j(200, out);
    // check slugExists while A is live (expect true)
    let se1 = await fetch(`${GHL}/blogs/posts/url-slug-exists?locationId=${LOC}&urlSlug=${slug}&blogId=${BLOG}`, { headers: H() });
    out.slugExists_whileLive = await se1.json().catch(() => ({}));
    // archive A
    out.archiveA = await put(A.id, mk(slug, 'AAA-original', 'ARCHIVED'));
    // check slugExists after archive (does archiving free it?)
    let se2 = await fetch(`${GHL}/blogs/posts/url-slug-exists?locationId=${LOC}&urlSlug=${slug}&blogId=${BLOG}`, { headers: H() });
    out.slugExists_afterArchive = await se2.json().catch(() => ({}));
    // create B at the SAME slug
    const B = await create(mk(slug, 'BBB-recreated', 'PUBLISHED')); out.createB = B;
    out.SLUG_REUSED = B.urlSlug === slug;
    out.VERDICT = B.urlSlug === slug ? 'SAME URL PRESERVED ✓ (recreate viable)' : `NEW SLUG "${B.urlSlug}" (recreate would change the URL — NOT viable)`;
    // cleanup: archive B
    if (B.id) out.archiveB = await put(B.id, mk(B.urlSlug || slug, 'BBB-recreated', 'ARCHIVED'));
    return j(200, out);
  } catch (e) { return j(500, { error: String(e && e.message || e), out }); }
};
