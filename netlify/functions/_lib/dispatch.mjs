// Best-effort GitHub Actions dispatch for the featured-image render worker. Callers are
// background functions with no synchronous caller to report an error to, but a prior
// version swallowed every failure with an empty catch and never checked response.ok —
// so a bad/expired GITHUB_DISPATCH_TOKEN (or any transient GitHub API hiccup) left a post
// stuck with no error anywhere, no log, nothing. This logs the real failure reason instead.
// status-sync.mjs's daily self-heal re-dispatches anything still pending after a while,
// regardless of why the first attempt failed.
export async function dispatchFeaturedRender(postId, ghToken) {
  if (!ghToken) { console.error(`dispatchFeaturedRender: GITHUB_DISPATCH_TOKEN not configured, skipping post ${postId}`); return; }
  try {
    const r = await fetch('https://api.github.com/repos/escapepreneur/blog-tracker/dispatches', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ghToken}`, Accept: 'application/vnd.github+json', 'content-type': 'application/json' },
      body: JSON.stringify({ event_type: 'render-featured', client_payload: { post_id: postId } }),
    });
    if (!r.ok) console.error(`dispatchFeaturedRender: GitHub dispatch ${r.status} for post ${postId}: ${(await r.text()).slice(0, 200)}`);
  } catch (e) {
    console.error(`dispatchFeaturedRender: network error for post ${postId}: ${e && e.message}`);
  }
}
