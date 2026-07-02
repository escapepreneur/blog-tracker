// TEMPORARY: publish the pin for ONE eligible live ESC post (the Lead Magnet post) via GHL,
// to validate real Pinterest delivery. Mirrors the cron's pinterest pass. Removed after.
import { postPinsForPost, getGhlUserId } from './_lib/pinterest.mjs';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpprrknnkjyluhgtoezu.supabase.co';
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PIT = process.env.GHL_API_TOKEN;
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });

export const handler = async () => {
  if (!SKEY || !PIT) return json(200, { error: 'missing SUPABASE_SERVICE_ROLE_KEY or GHL_API_TOKEN' });
  const h = { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'content-type': 'application/json' };
  const rest = (q, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: h, ...opts });

  const target = 'https://eschub.com/post/how-to-create-lead-magnet';
  const rows = await (await rest(`posts?url=eq.${encodeURIComponent(target)}&select=id,blog,title,primary_keyword,url,cluster,pinterest_posted&limit=1`)).json();
  if (!rows || !rows.length) return json(200, { note: 'lead-magnet post not found' });
  const post = rows[0];
  const [d] = await (await rest(`post_drafts?post_id=eq.${post.id}&select=assets,meta_description`)).json();
  if (!d || !d.assets || !d.assets.pin_image_url) return json(200, { note: 'that post has no rendered pin', post: post.title });

  const userId = await getGhlUserId(PIT);
  const res = await postPinsForPost({ pit: PIT, userId, brand: post.blog, post, draft: d });
  const ok = res.posted && res.posted.some(x => !x.error);
  if (ok) await rest(`posts?id=eq.${post.id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ pinterest_posted: true }) });
  return json(200, { post: post.title, userId_found: !!userId, result: res });
};
