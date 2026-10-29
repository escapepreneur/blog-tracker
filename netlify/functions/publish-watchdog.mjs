// Scheduled daily at 14:00 UTC = 16:00 SAST (see netlify.toml). Emails Karen if any post that
// should have gone live by now has not: still 'scheduled' past its go-live moment, or marked
// live today but the page does not actually load. Silent when everything is fine. It runs on
// its own schedule, separate from publish-due, so a stuck publisher cannot hide its own failure.
import { getDueScheduled } from './_lib/publishdue.mjs';
import { alertHtml, sendAlert } from './_lib/alertmail.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpprrknnkjyluhgtoezu.supabase.co';

async function pageStatus(url) {
  try { return (await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(10000) })).status; }
  catch (e) { return `error: ${e.message}`; }
}

export const handler = async () => {
  try {
    const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
    const h = { apikey: KEY, Authorization: `Bearer ${KEY}` };
    const rest = (q) => fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: h });
    const today = new Date().toISOString().slice(0, 10);
    const problems = [];

    const { due } = await getDueScheduled({ rest });
    for (const p of due) problems.push(`<b>${p.title || p.primary_keyword || p.id}</b> (${p.blog === 'esc' ? 'ESC Hub' : 'Escapepreneur®'}) was due at 3pm SAST on ${p.goLive} but is still scheduled, not published.`);

    const r = await rest(`posts?status=eq.live&published_date=eq.${today}&url=not.is.null&select=id,blog,title,primary_keyword,url`);
    if (!r.ok) throw new Error(`fetch live-today failed: ${r.status}`);
    for (const p of await r.json()) {
      const st = await pageStatus(p.url);
      if (st !== 200) problems.push(`<b>${p.title || p.primary_keyword || p.id}</b> is marked live but its page is not loading (${st}): ${p.url}`);
    }

    console.log(`[publish-watchdog] ${today}: ${problems.length} problem(s)`);
    if (!problems.length) return { statusCode: 200, body: JSON.stringify({ ok: true }) };

    await sendAlert({
      subject: `⚠️ Scheduled post not live by 4pm SAST (${problems.length})`,
      html: alertHtml({
        intro: 'These posts should be live by now and are not:',
        items: problems,
        note: 'Checked at 4pm SAST. Scheduled posts are published automatically at 3pm SAST; this only emails when one is missing.',
      }),
    });
    return { statusCode: 200, body: JSON.stringify({ emailed: problems.length }) };
  } catch (e) {
    console.error('[publish-watchdog] FAILED:', e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
