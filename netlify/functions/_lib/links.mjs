// Auto-populate the internal-links tracker from a post's body.
// Parses <a href> links in the body, matches each to another post on the same blog
// (-> a post-link) or to a known link_destination (-> a page-link), and inserts any
// that aren't already recorded. De-duped and idempotent, so it's safe to re-run on
// every generate / AI-edit.
export async function syncInternalLinks({ supabaseUrl, headers, postId, brand, bodyHtml }) {
  if (!bodyHtml || !postId || !brand) return { added: 0 };
  const hrefs = [...bodyHtml.matchAll(/<a\s[^>]*href=["']([^"']+)["']/gi)].map(m => m[1]);
  if (!hrefs.length) return { added: 0 };

  const get = async (q) => { const r = await fetch(`${supabaseUrl}/rest/v1/${q}`, { headers }); return r.ok ? r.json() : []; };
  const [posts, dests, existing] = await Promise.all([
    get(`posts?blog=eq.${brand}&select=id,url`),
    get(`link_destinations?blog=eq.${brand}&select=id,url`),
    get(`internal_links?from_post_id=eq.${postId}&select=to_post_id,to_dest_id`),
  ]);

  const norm = (u) => String(u || '').replace(/^https?:\/\//, '').replace(/[#?].*$/, '').replace(/\/+$/, '').toLowerCase();
  const haveP = new Set(existing.filter(e => e.to_post_id).map(e => e.to_post_id));
  const haveD = new Set(existing.filter(e => e.to_dest_id).map(e => e.to_dest_id));
  const rows = [];
  for (const href of hrefs) {
    const h = norm(href);
    if (!h) continue;
    const post = posts.find(p => p.url && p.id !== postId && norm(p.url) === h);
    if (post) { if (!haveP.has(post.id)) { haveP.add(post.id); rows.push({ blog: brand, from_post_id: postId, to_post_id: post.id }); } continue; }
    const dest = dests.find(d => d.url && norm(d.url) === h);
    if (dest && !haveD.has(dest.id)) { haveD.add(dest.id); rows.push({ blog: brand, from_post_id: postId, to_dest_id: dest.id }); }
  }
  if (rows.length) {
    await fetch(`${supabaseUrl}/rest/v1/internal_links`, {
      method: 'POST', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify(rows),
    });
  }
  return { added: rows.length };
}
