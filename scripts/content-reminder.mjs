#!/usr/bin/env node
// content-reminder: each day, look at the date 2 days out. For each blog, if nothing is
// set to go live that day (no scheduled post, no already-published post), email Karen so she
// has lead time to queue content. Emails only when there's a gap. Sends via Resend.
//   env: SUPABASE_SERVICE_ROLE_KEY (required), RESEND_API_KEY (required to actually send),
//        REMINDER_EMAIL (default karen@escapepreneur.com), REMINDER_LEAD_DAYS (default 2)
import { BRANDS } from '../netlify/functions/_lib/brands.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpprrknnkjyluhgtoezu.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND = process.env.RESEND_API_KEY;
const TO = process.env.REMINDER_EMAIL || 'karen@escapepreneur.com';
const LEAD = parseInt(process.env.REMINDER_LEAD_DAYS || '2', 10);
const TRACKER = 'https://bloggingtracker.netlify.app';
if (!KEY) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const h = { apikey: KEY, Authorization: `Bearer ${KEY}` };
// target date = today + LEAD days, as YYYY-MM-DD in Karen's timezone (America/New_York)
const ymdNY = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
const target = ymdNY(Date.now() + LEAD * 86400000);
const pretty = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(Date.now() + LEAD * 86400000));

// A blog "has content" for the date if a post is scheduled for it OR already published that day.
async function hasContent(blog) {
  const q = `posts?blog=eq.${blog}&select=id,title,status,scheduled_date,published_date&or=(scheduled_date.eq.${target},published_date.eq.${target})`;
  const rows = await (await fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: h })).json();
  return Array.isArray(rows) && rows.length > 0;
}

const gaps = [];
for (const key of Object.keys(BRANDS)) {
  const ok = await hasContent(key);
  console.log(`${BRANDS[key].name} (${key}) on ${target}: ${ok ? 'has content ✓' : 'NOTHING scheduled ✗'}`);
  if (!ok) gaps.push(BRANDS[key].name);
}

if (!gaps.length) { console.log('All blogs have content for', target, '— no email needed.'); process.exit(0); }

const brandsLine = gaps.join(' and ');
const subject = `📝 Content needed: ${gaps.join(' + ')} — ${pretty}`;
const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;color:#143434;line-height:1.6">
  <p>Heads up — nothing is going live in <b>2 days</b> (${pretty}) on:</p>
  <ul>${gaps.map(g => `<li><b>${g}</b></li>`).join('')}</ul>
  <p>Queue a post so ${gaps.length > 1 ? 'these blogs' : 'this blog'} don't run dry.</p>
  <p><a href="${TRACKER}" style="display:inline-block;background:#1AA3A0;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Open the Content Dashboard →</a></p>
  <p style="font-size:12px;color:#5b7373">You get this only when a blog has nothing scheduled ${LEAD} days out.</p>
</div>`;

if (!RESEND) { console.log(`GAP found for: ${brandsLine}. RESEND_API_KEY not set — would have emailed ${TO}.`); process.exit(0); }

const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { Authorization: `Bearer ${RESEND}`, 'content-type': 'application/json' },
  body: JSON.stringify({ from: 'ESC Content Dashboard <onboarding@resend.dev>', to: [TO], subject, html }),
});
const out = await res.text();
if (!res.ok) { console.error('Resend send failed', res.status, out.slice(0, 300)); process.exit(1); }
console.log(`Reminder emailed to ${TO} for: ${brandsLine} (${target}).`);
