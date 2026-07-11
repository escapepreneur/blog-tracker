// TEMP one-off: PROVE GHL PUT changes rawHTML in place. Create DRAFT (marker AAA) ->
// read body back via the single-post detail endpoint -> PUT update to BBB -> read body
// back again -> archive. If the detail read shows BBB, in-place body update is confirmed.
const GHL = 'https://services.leadconnectorhq.com';
const LOC = process.env.GHL_LOCATION_ID || 'EoD3KT6IiKx0oIXjInOt';
const PIT = process.env.GHL_API_TOKEN;
const BLOG = '35V2JGaHwBWLFjBg2Ghx';
const H = () => ({ Authorization: `Bearer ${PIT}`, Version: '2021-07-28', 'Content-Type': 'application/json' });
const j = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o, null, 2) });
const bodyOf = (d) => { const p = d.blogPost || d.data || d; return p && (p.rawHTML || p.content || ''); };

// try a few plausible single-post detail routes; return the first that returns a body
async function detail(id) {
  const tries = [
    `${GHL}/blogs/posts/${id}?locationId=${LOC}`,
    `${GHL}/blogs/posts/${id}`,
    `${GHL}/blogs/${BLOG}/posts/${id}?locationId=${LOC}`,
  ];
  for (const u of tries) {
    try {
      const r = await fetch(u, { headers: H() });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { const p = d.blogPost || d.data || d; return { status: r.status, rawHTML: bodyOf(d), title: p.title, description: p.description }; }
    } catch {}
  }
  return { status: 'none-worked' };
}

export const handler = async () => {
  if (!PIT) return j(500, { error: 'no GHL_API_TOKEN' });
  const out = {}; const slug = 'zz-writetest-' + Date.now().toString(36);
  try {
    let r = await fetch(`${GHL}/blogs/posts`, { method: 'POST', headers: H(), body: JSON.stringify({
      title: 'ZZ Writetest DELETE ME', locationId: LOC, blogId: BLOG, rawHTML: '<p>MARKER-AAA-ORIGINAL</p>',
      status: 'DRAFT', urlSlug: slug, description: 'writetest', publishedAt: new Date().toISOString() }) });
    let d = await r.json().catch(() => ({})); const p = d.blogPost || d.data || d; const id = p._id || p.id;
    out.create = { httpStatus: r.status, id };
    if (!id) return j(200, { ...out, raw: d });
    out.detail_before = await detail(id);
    const up = { title: 'ZZ Writetest UPDATED', locationId: LOC, blogId: BLOG, rawHTML: '<p>MARKER-BBB-UPDATED</p>',
      status: 'DRAFT', urlSlug: slug, description: 'writetest updated', imageUrl: p.imageUrl || '', imageAltText: 'x',
      categories: (p.categories || []).map(c => c._id || c.id || c), author: p.author, publishedAt: p.publishedAt || new Date().toISOString() };
    let r2 = await fetch(`${GHL}/blogs/posts/${id}`, { method: 'PUT', headers: H(), body: JSON.stringify(up) });
    out.update = { httpStatus: r2.status };
    out.detail_after = await detail(id);
    await fetch(`${GHL}/blogs/posts/${id}`, { method: 'PUT', headers: H(), body: JSON.stringify({ ...up, status: 'ARCHIVED' }) });
    out.id = id; out.slug = slug;
    const a = out.detail_after || {};
    out.VERDICT = {
      body: /MARKER-BBB/.test(a.rawHTML || '') ? 'UPDATES ✓' : 'LOCKED (ignored)',
      title: a.title === 'ZZ Writetest UPDATED' ? 'UPDATES ✓' : 'LOCKED (ignored)',
      meta: a.description === 'writetest updated' ? 'UPDATES ✓' : 'LOCKED (ignored)',
    };
    return j(200, out);
  } catch (e) { return j(500, { error: String(e && e.message || e), out }); }
};
