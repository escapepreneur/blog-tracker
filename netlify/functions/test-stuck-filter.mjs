// TEMP: verify the PostgREST JSON-field filter syntax used by status-sync.mjs's
// featured-image self-heal actually matches rows. Delete after testing.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpprrknnkjyluhgtoezu.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });

export const handler = async () => {
  const h = { apikey: KEY, Authorization: `Bearer ${KEY}` };
  const cutoff = new Date(Date.now() - 1000).toISOString(); // 1 second ago, so anything qualifies
  const url = `${SUPABASE_URL}/rest/v1/post_drafts?assets->>featured_image_search=not.is.null&assets->>featured_image_url=is.null&generated_at=lt.${cutoff}&select=post_id,generated_at`;
  const r = await fetch(url, { headers: h });
  const body = await r.text();
  return json(200, { status: r.status, url, body: body.slice(0, 2000) });
};
