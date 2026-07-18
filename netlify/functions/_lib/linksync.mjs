// Sync a post's internal_links TRACKING rows from its post_drafts.internal_links report.
// The generator embeds links directly in body_html and reports the 3 it used — but nothing
// ever copied that report into the internal_links table, which is what the dashboard's
// "Needs Links" widget actually reads from. Result: real, published links were invisible to
// the dashboard, making posts look under-linked when they weren't. Call this once a post
// goes live (immediate publish or the daily auto-publish cron) so the tracker matches reality.
// Best-effort — a failure here should never block the actual publish.
export async function syncInternalLinks({ rest, h, blog, postId }) {
  const [draft] = await (await rest(`post_drafts?post_id=eq.${postId}&select=internal_links`)).json();
  const links = draft && Array.isArray(draft.internal_links) ? draft.internal_links : [];
  const urls = [...new Set(links.map(l => l && l.url).filter(Boolean))];
  if (!urls.length) return 0;

  const inList = urls.map(u => `"${u}"`).join(',');
  const targets = await (await rest(`posts?url=in.(${inList})&select=id,url`)).json();
  const targetIdByUrl = new Map((targets || []).map(t => [t.url, t.id]));

  const existing = await (await rest(`internal_links?from_post_id=eq.${postId}&select=to_post_id`)).json();
  const existingIds = new Set((existing || []).map(e => e.to_post_id));

  let added = 0;
  for (const url of urls) {
    const toId = targetIdByUrl.get(url);
    if (!toId || toId === postId || existingIds.has(toId)) continue;
    const r = await rest('internal_links', {
      method: 'POST', headers: { ...h, Prefer: 'return=minimal' },
      body: JSON.stringify({ blog, from_post_id: postId, to_post_id: toId }),
    });
    if (r.ok) { added++; existingIds.add(toId); }
  }
  return added;
}
