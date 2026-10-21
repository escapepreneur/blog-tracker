#!/usr/bin/env node
// gsc-snapshot: weekly per-post Search Console snapshot -> gsc_positions.
// Pulls each brand's page-level performance (90-day window) and writes ONE row per
// live post (position, impressions, clicks; source note 'GSC-auto'). This turns the
// gsc_positions time-series into an automatic trend line — no manual entry / CSV.
// Idempotent + weekly: a post is skipped if it already has a GSC-auto snapshot in the
// last 6 days, so running daily from the status-sync cron yields ~one row/post/week.
//   env: SUPABASE_SERVICE_ROLE_KEY, GOOGLE_SA_KEY
import { BRANDS } from '../netlify/functions/_lib/brands.mjs';
import { searchAnalytics, getServiceAccount, inspectIndexDetail, listSitemaps, submitSitemap } from '../netlify/functions/_lib/google.mjs';

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
    const posts = await (await rest(`posts?status=eq.live&blog=eq.${blog}&url=not.is.null&select=id,url,indexed`)).json();
    if (!Array.isArray(posts) || !posts.length) { console.log(`  [${blog}] no live posts with urls`); continue; }

    // The same page can appear as http/https, www, with a trailing slash, a ?query or a
    // #fragment. Key every address the same way so they all merge into one post.
    const keyOf = (u) => {
      const clean = String(u || '').split('#')[0].split('?')[0].replace(/\/+$/, '').toLowerCase();
      const m = clean.match(/\/post\/([^/]+)$/);
      return m ? 'post:' + m[1] : clean.replace(/^https?:\/\/(www\.)?/, '');
    };

    try {
      const maps = await listSitemaps(prop);
      if (!maps.length) { console.error(`  [${blog}] NO SITEMAP is submitted in Search Console for ${prop}`); failures++; }
      for (const m of maps) {
        const posts = (m.contents || []).map(c => `${c.type}: ${c.submitted} submitted, ${c.indexed} indexed`).join('; ');
        console.log(`  [${blog}] sitemap ${m.path} | last downloaded ${m.lastDownloaded || 'never'} | errors ${m.errors || 0}, warnings ${m.warnings || 0}${posts ? ' | ' + posts : ''}`);
        // Google had stopped reading the No More Somedays sitemap after 27 July, so every post
        // published since was "unknown to Google". If it has not been read in 14 days, resubmit it.
        const ageDays = m.lastDownloaded ? (Date.now() - Date.parse(m.lastDownloaded)) / 86400000 : Infinity;
        if (ageDays > 14) {
          try { await submitSitemap(prop, m.path); console.log(`  [${blog}] RESUBMITTED ${m.path} (Google last read it ${m.lastDownloaded || 'never'})`); }
          catch (e) { console.error(`  [${blog}] could not resubmit ${m.path}: ${e.message}`); failures++; }
        }
      }
    } catch (e) { console.error(`  [${blog}] could not read sitemaps: ${e.message}`); }

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
    const inserts = [];
    const noData = posts.filter(p => !byPage.get(keyOf(p.url)));
    for (const p of posts) {
      if (recentSet.has(p.id)) continue; // one row per post per run
      recentSet.add(p.id);
      const a = byPage.get(keyOf(p.url));
      inserts.push({
        post_id: p.id, recorded_date: today,
        position: a && a.impressions ? Math.round((a.posw / a.impressions) * 10) / 10 : null,
        impressions: a ? a.impressions : 0, clicks: a ? a.clicks : 0,
        notes: 'GSC-auto',
      });
    }
    // Audit every post Search Console has nothing on: is the page actually up, and does Google
    // actually index it? Corrects posts.indexed when it was wrong, and fails the run if a
    // "live" post is really a broken page.
    if (noData.length) {
      console.log(`  [${blog}] ${noData.length} live post(s) with no Search Console data, checking each:`);
      let notIndexed = 0, broken = 0, corrected = 0;
      // Checked 5 at a time: one by one, Google's inspection call made this job take 11 minutes.
      let next = 0;
      const worker = async () => {
        while (next < noData.length) {
          const p = noData[next++];
          let code = 0, finalUrl = p.url;
          try {
            const r = await fetch(p.url, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (compatible; blog-tracker-audit)' } });
            code = r.status; finalUrl = r.url || p.url;
          } catch { code = 0; }
          // A "live" post that redirects somewhere else (for example a deleted post sent to a 404
          // page) still answers 200 once the redirect is followed, so compare where it ended up.
          const movedAway = code > 0 && code < 400 && keyOf(finalUrl) !== keyOf(p.url);
          const d = await inspectIndexDetail(prop, p.url).catch(() => null);
          const why = d ? `${d.coverage || 'unknown'}${d.lastCrawled ? ', last crawled ' + d.lastCrawled.slice(0, 10) : ''}` : 'could not inspect';
          if (code === 0 || code >= 400 || movedAway) {
            broken++; failures++;
            console.error(`    BROKEN  ${movedAway ? 'redirects to ' + finalUrl : 'http ' + code}  ${p.url}  (${why})`);
          }
          else if (d && d.indexed === 'no') { notIndexed++; console.log(`    NOT INDEXED  ${p.url}  (${why})`); }
          else console.log(`    indexed, no impressions yet  ${p.url}`);
          let fix = null;
          if (d && d.indexed === 'yes' && p.indexed !== 'yes') fix = 'yes';
          if (d && d.indexed === 'no' && p.indexed === 'yes') fix = 'no';
          if (fix) {
            const r = await rest(`posts?id=eq.${p.id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ indexed: fix }) });
            if (r.ok) corrected++; else { console.error(`    could not update indexed flag for ${p.url}: ${r.status}`); failures++; }
          }
        }
      };
      await Promise.all(Array.from({ length: 5 }, worker));
      console.log(`  [${blog}] audit: ${notIndexed} not indexed, ${broken} broken, ${corrected} indexed flag(s) corrected`);
    }
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
