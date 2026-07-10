// TEMP one-off: verify whether GHL PUT can update an existing post's body (rawHTML) in place.
// Creates a throwaway DRAFT with marker AAA, PUTs an update to marker BBB + new title,
// re-reads to confirm, then ARCHIVES the throwaway. Returns what changed. Delete after use.
const GHL = 'https://services.leadconnectorhq.com';
const LOC = process.env.GHL_LOCATION_ID || 'EoD3KT6IiKx0oIXjInOt';
const PIT = process.env.GHL_API_TOKEN;
const BLOG = '35V2JGaHwBWLFjBg2Ghx'; // ESC Hub main blog
const H = () => ({ Authorization: `Bearer ${PIT}`, Version: '2021-07-28', 'Content-Type': 'application/json' });
const j = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o, null, 2) });

export const handler = async () => {
  if (!PIT) return j(500, { error: 'no GHL_API_TOKEN' });
  const out = {}; const slug = 'zz-writetest-' + Date.now().toString(36);
  try {
    // 1. create DRAFT with marker AAA
    let r = await fetch(`${GHL}/blogs/posts`, { method: 'POST', headers: H(), body: JSON.stringify({
      title: 'ZZ Writetest DELETE ME', locationId: LOC, blogId: BLOG, rawHTML: '<p>MARKER-AAA-ORIGINAL</p>',
      status: 'DRAFT', urlSlug: slug, description: 'writetest original', publishedAt: new Date().toISOString() }) });
    let d = await r.json().catch(() => ({})); const p = d.blogPost || d.data || d; const id = p._id || p.id;
    out.create = { httpStatus: r.status, id, rawHTML_echo: p.rawHTML, title_echo: p.title };
    if (!id) return j(200, { ...out, note: 'no id returned from create' });
    // 2. PUT update: rawHTML -> BBB + new title (full object to satisfy any required-field rules)
    const up = { title: 'ZZ Writetest UPDATED', locationId: LOC, blogId: BLOG, rawHTML: '<p>MARKER-BBB-UPDATED</p>',
      status: 'DRAFT', urlSlug: slug, description: 'writetest updated', imageUrl: p.imageUrl || '', imageAltText: 'x',
      categories: (p.categories || []).map(c => c._id || c.id || c), author: p.author, publishedAt: p.publishedAt || new Date().toISOString() };
    let r2 = await fetch(`${GHL}/blogs/posts/${id}`, { method: 'PUT', headers: H(), body: JSON.stringify(up) });
    let d2 = await r2.json().catch(() => ({})); const p2 = d2.blogPost || d2.data || d2;
    out.update = { httpStatus: r2.status, rawHTML_echo: p2.rawHTML, title_echo: p2.title, err: r2.ok ? undefined : JSON.stringify(d2).slice(0, 300) };
    // 3. re-read via list to confirm the title/description actually changed server-side
    let r3 = await fetch(`${GHL}/blogs/posts/all?locationId=${LOC}&blogId=${BLOG}&limit=100&offset=0&status=DRAFT`, { headers: H() });
    let d3 = await r3.json().catch(() => ({})); const f = (d3.blogs || d3.data || []).find(x => (x._id || x.id) === id);
    out.reread = { httpStatus: r3.status, title: f && f.title, description: f && f.description, rawHTML_present: !!(f && f.rawHTML) };
    // 4. archive the throwaway
    let r4 = await fetch(`${GHL}/blogs/posts/${id}`, { method: 'PUT', headers: H(), body: JSON.stringify({ ...up, status: 'ARCHIVED' }) });
    out.archive = { httpStatus: r4.status };
    out.id = id; out.slug = slug;
    return j(200, out);
  } catch (e) { return j(500, { error: String(e && e.message || e), out }); }
};
