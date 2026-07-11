// TEMP one-off: can GHL PUT change an existing post's urlSlug? (Enables the safe
// republish sequence: create new at temp slug -> delete old -> rename new to freed slug.)
// Create A at a temp slug -> PUT urlSlug to a final slug -> read back via detail -> archive.
const GHL = 'https://services.leadconnectorhq.com';
const LOC = process.env.GHL_LOCATION_ID || 'EoD3KT6IiKx0oIXjInOt';
const PIT = process.env.GHL_API_TOKEN;
const BLOG = '35V2JGaHwBWLFjBg2Ghx';
const H = () => ({ Authorization: `Bearer ${PIT}`, Version: '2021-07-28', 'Content-Type': 'application/json' });
const j = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o, null, 2) });
const full = (slug, status) => ({ title: 'ZZ Renametest DELETE ME', locationId: LOC, blogId: BLOG, rawHTML: '<p>x</p>', status, urlSlug: slug, description: 'renametest', publishedAt: new Date().toISOString() });

export const handler = async () => {
  if (!PIT) return j(500, { error: 'no GHL_API_TOKEN' });
  const out = {}; const base = 'zz-rename-' + Date.now().toString(36);
  const tempSlug = base + '-temp', finalSlug = base + '-final';
  const detail = async (id) => { const r = await fetch(`${GHL}/blogs/posts/${id}?locationId=${LOC}`, { headers: H() }); const d = await r.json().catch(() => ({})); const p = d.blogPost || d.data || d; return { status: r.status, urlSlug: p.urlSlug }; };
  try {
    let r = await fetch(`${GHL}/blogs/posts`, { method: 'POST', headers: H(), body: JSON.stringify(full(tempSlug, 'PUBLISHED')) });
    let d = await r.json().catch(() => ({})); const p = d.blogPost || d.data || d; const id = p._id || p.id;
    out.create = { status: r.status, id, urlSlug: p.urlSlug };
    if (!id) return j(200, out);
    // PUT to change the slug to finalSlug
    let r2 = await fetch(`${GHL}/blogs/posts/${id}`, { method: 'PUT', headers: H(), body: JSON.stringify(full(finalSlug, 'PUBLISHED')) });
    out.putRename = { status: r2.status, err: r2.ok ? undefined : (await r2.text()).slice(0, 200) };
    out.detail_after = await detail(id);
    out.SLUG_RENAMED = out.detail_after.urlSlug === finalSlug;
    out.VERDICT = out.detail_after.urlSlug === finalSlug ? 'PUT CAN RENAME SLUG ✓ (safe sequence viable)' : `slug is "${out.detail_after.urlSlug}" (rename ignored — safe sequence NOT viable via PUT)`;
    await fetch(`${GHL}/blogs/posts/${id}`, { method: 'PUT', headers: H(), body: JSON.stringify(full(out.detail_after.urlSlug || finalSlug, 'ARCHIVED')) });
    return j(200, out);
  } catch (e) { return j(500, { error: String(e && e.message || e), out }); }
};
