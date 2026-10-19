#!/usr/bin/env node
// gsc-snapshot: weekly per-post Search Console snapshot -> gsc_positions.
// Pulls each brand's page-level performance (90-day window) and writes ONE row per
// live post (position, impressions, clicks; source note 'GSC-auto'). This turns the
// gsc_positions time-series into an automatic trend line — no manual entry / CSV.
// Idempotent + weekly: a post is skipped if it already has a GSC-auto snapshot in the
// last 6 days, so running daily from the status-sync cron yields ~one row/post/week.
//   env: SUPABASE_SERVICE_ROLE_KEY, GOOGLE_SA_KEY
import { BRANDS } from '../netlify/functions/_lib/brands.mjs';
import { searchAnalytics, getServiceAccount } from '../netlify/functions/_lib/google.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpprrknnkjyluhgtoezu.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) { console.error('[gsc-snapshot] Missing SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
if (!getServiceAccount()) { console.error('[gsc-snapshot] GOOGLE_SA_KEY is missing or not valid JSON, so no snapshot can be taken.'); process.exit(1); }
let failures = 0;

const h = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const rest = (q, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: h, ...opts });
const ymd = (d) => d.toISOString().slice(0, 10);

(async () => {
  const now = new Date();
  const today = ymd(now);
  const end = new Date(now); end.setDate(end.getDate() - 3);   // GSC lags ~2-3 days
  const start = new Date(now); start.setDate(start.getDate() - 90);
  const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 6); // weekly guard
  console.log(`[gsc-snapshot] today=${today} window=${ymd(start)}..${ymd(end)}`);

  // posts already snapshotted (auto) within the last 6 days -> skip (keeps it weekly)
  const recent = await (await rest(`gsc_positions?select=post_id&notes=like.*GSC-auto*&recorded_date=gte.${ymd(cutoff)}`)).json();
  const recentSet = new Set((Array.isArray(recent) ? recent : []).map(r => r.post_id));

  let total = 0;
  for (const blog of Object.keys(BRANDS)) {
    const prop = BRANDS[blog] && BRANDS[blog].gscProperty;
    if (!prop) continue;
    const posts = await (await rest(`posts?status=eq.live&blog=eq.${blog}&url=not.is.null&select=id,url`)).json();
    if (!Array.isArray(posts) || !posts.length) { console.log(`  [${blog}] no live posts with urls`); continue; }

    // The same page can appear as http/https, www, with a trailing slash, a ?query or a
    // #fragment. Key every address the same way so they all merge into one post.
    const keyOf = (u) => {
      const clean = String(u || '').split('#')[0].split('?')[0].replace(/\/+$/, '').toLowerCase();
      const m = clean.match(/\/post\/([^/]+)$/);
      return m ? 'post:' + m[1] : clean.replace(/^https?:\/\/(www\.)?/, '');
    };

    let rows;
    try { rows = await searchAnalytics({ siteUrl: prop, startDate: ymd(start), endDate: ymd(end), dimensions: ['page'], rowLimit: 2000 }); }
    catch (e) { console.error(`  [${blog}] GSC error: ${e.message}`); failures++; continue; }

    const byPage = new Map();
    for (const r of (rows || [])) {
      const page = keyOf(r.keys[0]);
      const a = byPage.get(page) || { clicks: 0, impressions: 0, posw: 0 };
      a.clicks += r.clicks; a.impressions += r.impressions; a.posw += (r.position || 0) * r.impressions;
      byPage.set(page, a);
    }
    // One row for EVERY live post. Search Console only lists pages that had at least one
    // impression, so a post missing from its report gets an explicit zero row instead of
    // silently dropping out of the trend.
    const inserts = [], noData = [];
    for (const p of posts) {
      if (recentSet.has(p.id)) continue; // one row per post per run
      recentSet.add(p.id);
      const a = byPage.get(keyOf(p.url));
      if (!a) noData.push(p.url);
      inserts.push({
        post_id: p.id, recorded_date: today,
        position: a && a.impressions ? Math.round((a.posw / a.impressions) * 10) / 10 : null,
        impressions: a ? a.impressions : 0, clicks: a ? a.clicks : 0,
        notes: 'GSC-auto',
      });
    }
    if (noData.length) console.log(`  [${blog}] ${noData.length} live post(s) had no Search Console data in this window:\n    ` + noData.join('\n    '));
    // insert in batches
    for (let i = 0; i < inserts.length; i += 50) {
      const batch = inserts.slice(i, i + 50);
      const res = await rest('gsc_positions', { method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify(batch) });
      if (!res.ok) { console.error(`  [${blog}] insert failed: ${res.status} ${await res.text()}`); failures++; }
    }
    console.log(`  [${blog}] ${inserts.length} post snapshot(s) written`);
    total += inserts.length;
  }
  console.log(`[gsc-snapshot] done. ${total} snapshot(s) total.`);
  if (failures) { console.error(`[gsc-snapshot] ${failures} step(s) failed, marking this run as failed so it is visible.`); process.exit(1); }
})().catch(e => { console.error('[gsc-snapshot] FAILED:', e.message); process.exit(1); });
