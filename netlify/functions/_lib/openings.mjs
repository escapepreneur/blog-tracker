// How posts OPEN. Fetch the recent openings of a blog (so the writer can avoid them) and compare a
// draft's opening against them (so the checker can flag a copy). Plain-text, no AI.
import { OPENING_PHRASES } from './brands.mjs';

// First paragraphs of the saved drafts on a blog, newest first. Never throws: if the lookup fails
// it logs and returns [], and the writer/checker simply have nothing to compare against.
export async function getRecentOpenings({ supabaseUrl, headers, blog, limit = 40, exclude = null }) {
  try {
    const r = await fetch(`${supabaseUrl}/rest/v1/rpc/recent_openings`, {
      method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ p_blog: blog, p_limit: limit, p_exclude: exclude }),
    });
    if (!r.ok) { console.error(`[openings] lookup failed ${r.status}`); return []; }
    const rows = await r.json();
    return (Array.isArray(rows) ? rows : []).map(x => ({ id: x.post_id, title: x.title || '', text: x.opening || '' })).filter(x => x.text);
  } catch (e) { console.error('[openings] lookup error', e.message); return []; }
}

const strip = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#?\w+;/g, ' ').replace(/\s+/g, ' ').trim();
// Lowercase words, curly apostrophes made straight, punctuation dropped.
const words = (s) => strip(s).toLowerCase().replace(/[‘’]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);
const grams = (w, k) => { const out = new Set(); for (let i = 0; i + k <= w.length; i++) out.add(w.slice(i, i + k).join(' ')); return out; };

export function firstParagraphs(html, n = 2) {
  const out = [];
  for (const m of String(html || '').matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const t = strip(m[1]);
    if (t) out.push(t);
    if (out.length >= n) break;
  }
  return out;
}

// Stock opening phrases found in the first two paragraphs.
export function openingPhraseHits(html) {
  const text = ' ' + words(firstParagraphs(html, 2).join(' ')).join(' ') + ' ';
  return OPENING_PHRASES.filter(p => text.includes(' ' + words(p).join(' ') + ' '));
}

// How close is this opening to other posts' openings? Returns up to two of the closest, with why.
//   very similar   : lots of the same word pairs
//   shared phrase  : the same five words in a row
//   same start     : the first four words match
export function similarOpenings(html, openings) {
  const mine = words(firstParagraphs(html, 1)[0] || '');
  if (mine.length < 6 || !openings || !openings.length) return [];
  const mine2 = grams(mine, 2), mine5 = grams(mine, 5), start = mine.slice(0, 4).join(' ');
  const found = [];
  for (const o of openings) {
    const w = words(o.text);
    if (w.length < 6) continue;
    const o2 = grams(w, 2);
    let inter = 0; for (const g of mine2) if (o2.has(g)) inter++;
    const jac = inter / (mine2.size + o2.size - inter || 1);
    const sharedPhrase = [...grams(w, 5)].find(g => mine5.has(g));
    const sameStart = w.slice(0, 4).join(' ') === start;
    if (jac >= 0.3) found.push({ title: o.title, why: `is very similar to the opening of`, score: jac });
    else if (sameStart) found.push({ title: o.title, why: `starts with the same four words ("${start}") as`, score: 0.25 });
    else if (sharedPhrase) found.push({ title: o.title, why: `shares the phrase "${sharedPhrase}" with the opening of`, score: 0.2 });
  }
  return found.sort((a, b) => b.score - a.score).slice(0, 2);
}
