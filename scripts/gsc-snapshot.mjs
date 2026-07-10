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
if (!getServiceAccount()) { console.log('[gsc-snapshot] GOOGLE_SA_KEY not set — skipping (no-op).'); process.exit(0); }

const h = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const rest = (q, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: h, ...opts });
const norm = (u) => (u || '').replace(/\/+$/, '').toLowerCase();
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
    const byUrl = new Map(posts.map(p => [norm(p.url), p.id]));

    let rows;
    try { rows = await searchAnalytics({ siteUrl: prop, startDate: ymd(start), endDate: ymd(end), dimensions: ['page'], rowLimit: 2000 }); }
    catch (e) { console.error(`  [${blog}] GSC error: ${e.message}`); continue; }

    // GSC lists in-page anchor links (…/post/x#uuid) as separate pages; strip the
    // #fragment and merge so a post's snapshot includes all its impressions.
    const byPage = new Map();
    for (const r of (rows || [])) {
      const page = norm((r.keys[0] || '').split('#')[0]);
      const a = byPage.get(page) || { clicks: 0, impressions: 0, posw: 0 };
      a.clicks += r.clicks; a.impressions += r.impressions; a.posw += (r.position || 0) * r.impressions;
      byPage.set(page, a);
    }
    const inserts = [];
    for (const [page, a] of byPage) {
      const pid = byUrl.get(page);
      if (!pid || recentSet.has(pid)) continue;
      recentSet.add(pid); // one row per post per run
      inserts.push({
        post_id: pid, recorded_date: today,
        position: a.impressions ? Math.round((a.posw / a.impressions) * 10) / 10 : null,
        impressions: a.impressions, clicks: a.clicks,
        notes: 'GSC-auto',
      });
    }
    // insert in batches
    for (let i = 0; i < inserts.length; i += 50) {
      const batch = inserts.slice(i, i + 50);
      const res = await rest('gsc_positions', { method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify(batch) });
      if (!res.ok) console.error(`  [${blog}] insert failed: ${res.status} ${await res.text()}`);
    }
    console.log(`  [${blog}] ${inserts.length} post snapshot(s) written`);
    total += inserts.length;
  }
  console.log(`[gsc-snapshot] done. ${total} snapshot(s) total.`);
})().catch(e => { console.error('[gsc-snapshot] FAILED:', e.message); process.exit(1); });
