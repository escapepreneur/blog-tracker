#!/usr/bin/env node
// content-reminder: each day, look at the date LEAD days out. For each blog, if nothing is
// scheduled to go live on that day OR LATER (and nothing already published from then on), the
// queue is about to run dry, so email Karen and Sienna to leave lead time to queue content.
// Emails only when a queue is running out. Sends via Resend.
//   env: SUPABASE_SERVICE_ROLE_KEY (required), RESEND_API_KEY (required to actually send),
//        REMINDER_EMAIL (default karen + sienna), REMINDER_LEAD_DAYS (default 2)
import { BRANDS } from '../netlify/functions/_lib/brands.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpprrknnkjyluhgtoezu.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND = process.env.RESEND_API_KEY;
const TO = (process.env.REMINDER_EMAIL || 'karen@escapepreneur.com,sienna@thekings.com.au').split(',').map(s => s.trim()).filter(Boolean);
const LEAD = parseInt(process.env.REMINDER_LEAD_DAYS || '2', 10);
const TRACKER = 'https://blog.escapepreneur.com';
if (!KEY) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const h = { apikey: KEY, Authorization: `Bearer ${KEY}` };
// target date = today + LEAD days, as YYYY-MM-DD in Karen's timezone (America/New_York)
const ymdNY = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
const target = ymdNY(Date.now() + LEAD * 86400000);
const pretty = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(Date.now() + LEAD * 86400000));
const prettyYmd = (d) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(d + 'T12:00:00Z'));

// A blog "has content" if a post is scheduled for the target day or any day after it (or was
// published from then on). The old check looked at the exact target day only, so once posting
// moved to every second day, every rest day looked like a gap and a reminder fired daily for
// whichever blog was resting. This only fires when the queue genuinely runs out.
async function hasContent(blog) {
  const q = `posts?blog=eq.${blog}&select=id&or=(scheduled_date.gte.${target},published_date.gte.${target})&limit=1`;
  const rows = await (await fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: h })).json();
  return Array.isArray(rows) && rows.length > 0;
}

// The furthest-out scheduled date, so the email can say where the queue ends.
async function lastQueued(blog) {
  const q = `posts?blog=eq.${blog}&scheduled_date=not.is.null&select=scheduled_date&order=scheduled_date.desc&limit=1`;
  const rows = await (await fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: h })).json();
  return Array.isArray(rows) && rows[0] ? rows[0].scheduled_date : null;
}

const gaps = [];
for (const key of Object.keys(BRANDS)) {
  const ok = await hasContent(key);
  console.log(`${BRANDS[key].name} (${key}), from ${target}: ${ok ? 'queue covers it' : 'NOTHING scheduled'}`);
  if (!ok) gaps.push({ name: BRANDS[key].name, last: await lastQueued(key) });
}

if (!gaps.length) { console.log('Every blog has content scheduled from', target, 'onwards, no email needed.'); process.exit(0); }

const names = gaps.map(g => g.name);
const brandsLine = names.join(' and ');
const subject = `📝 Content needed: ${names.join(' + ')}, queue runs out before ${pretty}`;
const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;color:#143434;line-height:1.6">
  <p>Heads up: nothing is scheduled to go live on <b>${pretty}</b> or any day after it for:</p>
  <ul>${gaps.map(g => `<li><b>${g.name}</b>${g.last ? `, last post scheduled for ${prettyYmd(g.last)}` : ', nothing scheduled at all'}</li>`).join('')}</ul>
  <p>Queue a post so ${gaps.length > 1 ? 'these blogs' : 'this blog'} don't run dry.</p>
  <p><a href="${TRACKER}" style="display:inline-block;background:#1AA3A0;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Open Blog Studio →</a></p>
  <p style="font-size:12px;color:#5b7373">You only get this when a blog has nothing scheduled from ${LEAD} days out onwards, so posting every second day (or at any pace) won't trigger it.</p>
</div>`;

if (!RESEND) { console.log(`GAP found for: ${brandsLine}. RESEND_API_KEY not set, would have emailed ${TO}.`); process.exit(0); }

const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { Authorization: `Bearer ${RESEND}`, 'content-type': 'application/json' },
  body: JSON.stringify({ from: 'Blog Studio <onboarding@resend.dev>', to: TO, subject, html }),
});
const out = await res.text();
if (!res.ok) { console.error('Resend send failed', res.status, out.slice(0, 300)); process.exit(1); }
console.log(`Reminder emailed to ${TO} for: ${brandsLine} (${target}).`);
