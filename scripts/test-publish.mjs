// Local harness: create a GHL DRAFT from a post's saved draft, to validate the publish path.
//   SUPABASE_SERVICE_ROLE_KEY=... GHL_API_TOKEN=... node scripts/test-publish.mjs <post_id>
import { createBlogPost } from '../netlify/functions/_lib/ghl.mjs';

const SUPA = process.env.SUPABASE_URL || 'https://vpprrknnkjyluhgtoezu.supabase.co';
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PIT = process.env.GHL_API_TOKEN;
const postId = process.argv[2];
if (!SKEY || !PIT || !postId) { console.error('need SUPABASE_SERVICE_ROLE_KEY, GHL_API_TOKEN, <post_id>'); process.exit(1); }

const h = { apikey: SKEY, Authorization: `Bearer ${SKEY}` };
const rest = q => fetch(`${SUPA}/rest/v1/${q}`, { headers: h }).then(r => r.json());

const [post] = await rest(`posts?id=eq.${postId}&select=*`);
const [draft] = await rest(`post_drafts?post_id=eq.${postId}&select=*`);
if (!post) { console.error('post not found'); process.exit(1); }
if (!draft) { console.error('no draft for this post yet'); process.exit(1); }

console.log(`Creating DRAFT in GHL for [${post.blog}] "${post.primary_keyword}"...`);
const r = await createBlogPost({ brand: post.blog, post, draft, pit: PIT, status: 'DRAFT' });
console.log('GHL post id :', r.id);
console.log('category id :', (r.raw && r.raw.categories) || '(see raw)');
console.log('slug        :', r.slug);
console.log('live URL     :', r.url, '(once published)');
