#!/usr/bin/env node
// status-sync: flip scheduled posts to "live" once their go-live date has arrived.
// Mirrors the dashboard's manual "confirm live" action (dashboard.js:402 -> status:'live' + published_date).
// Default is a DRY RUN (reports only). Pass --live to actually write.
//
//   node scripts/status-sync.mjs            # dry run
//   node scripts/status-sync.mjs --live     # perform the flips
//
// Needs env SUPABASE_SERVICE_ROLE_KEY (set as a GitHub Actions secret in CI).

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpprrknnkjyluhgtoezu.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LIVE = process.argv.includes('--live');

if (!KEY) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
const h = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function getScheduled() {
  const url = `${SUPABASE_URL}/rest/v1/posts?status=eq.scheduled&select=id,blog,title,primary_keyword,status,scheduled_date,published_date,url`;
  const r = await fetch(url, { headers: h });
  if (!r.ok) throw new Error(`fetch scheduled failed: ${r.status} ${await r.text()}`);
  return r.json();
}

async function verifyLive(url) {
  try { return (await fetch(url, { method: 'GET', redirect: 'follow' })).status; }
  catch (e) { return `error: ${e.message}`; }
}

async function flip(post, goLiveDate) {
  const body = { status: 'live' };
  if (!post.published_date) body.published_date = goLiveDate; // keep existing pub date if present
  const r = await fetch(`${SUPABASE_URL}/rest/v1/posts?id=eq.${post.id}`, {
    method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`patch ${post.id} failed: ${r.status} ${await r.text()}`);
}

(async () => {
  console.log(`[status-sync] ${LIVE ? 'LIVE' : 'DRY-RUN'}  today=${today}`);
  const posts = await getScheduled();
  console.log(`[status-sync] ${posts.length} scheduled post(s) found`);
  let flipped = 0, waiting = 0, unverified = 0;
  for (const p of posts) {
    const label = `[${p.blog}] ${p.title || p.primary_keyword || p.id}`;
    const goLive = p.scheduled_date || p.published_date; // effective go-live date
    if (!goLive)          { console.log(`  WAIT  (no date)            ${label}`); waiting++; continue; }
    if (goLive > today)   { console.log(`  WAIT  (${goLive} > today)  ${label}`); waiting++; continue; }
    if (p.url) {
      const st = await verifyLive(p.url);
      if (st !== 200)     { console.log(`  HOLD  (url ${st})          ${label}  ${p.url}`); waiting++; continue; }
      console.log(`  FLIP  (url 200)            ${label}`);
    } else {
      console.log(`  FLIP  (date reached, no url to verify)  ${label}`);
      unverified++;
    }
    if (LIVE) await flip(p, goLive);
    flipped++;
  }
  console.log(`[status-sync] done. ${LIVE ? 'flipped' : 'would flip'}=${flipped}  waiting=${waiting}  flipped-without-url-check=${unverified}`);
})().catch(e => { console.error('[status-sync] FAILED:', e.message); process.exit(1); });
