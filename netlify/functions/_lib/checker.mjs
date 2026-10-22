// Mechanical brand/SEO checker. Deterministic rules only — the editorial
// judgement (anti-puff / beginner / "does it work") is a separate Claude pass.
// Returns a structured report: { verdict, hard:[], warn:[], pass:[] }.
// hard = blocks approval; warn = surfaced for the reviewer; pass = confirmed-clean.

import { BRANDS, BANNED, BANNED_PHRASES, SPARINGLY } from './brands.mjs';
import { openingPhraseHits, similarOpenings } from './openings.mjs';

const stripTags = (html='') => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const firstWords = (text, n) => text.split(/\s+/).slice(0, n).join(' ');
const wordCount = (text) => (text.match(/\b[\w’']+\b/g) || []).length;

function occurrences(haystack, term) {
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // whole-word-ish: not flanked by letters
  const re = new RegExp(`(?<![a-z])${esc}(?![a-z])`, 'gi');
  return (haystack.match(re) || []).length;
}
function phraseHits(haystack, term) {
  return (haystack.toLowerCase().split(term.toLowerCase()).length - 1);
}
// Loose keyword presence: do all the keyword's significant tokens appear (plural/article tolerant)?
// Lets a natural title like "Best Places ... Digital Nomad" satisfy "best place for digital nomad"
// instead of demanding the awkward exact phrase verbatim.
const KW_STOP = new Set(['a','an','the','for','of','to','in','on','and','or','your','my','as','at','with']);
function kwTokens(s) {
  return (String(s || '').toLowerCase().match(/[a-z0-9]+/g) || [])
    .filter(w => !KW_STOP.has(w))
    .map(w => w.replace(/ies$/, 'y').replace(/([a-z])s$/, '$1')); // crude singularise (places->place)
}
function keywordPresent(haystack, kw) {
  const kt = kwTokens(kw); if (!kt.length) return false;
  const hs = new Set(kwTokens(haystack));
  return kt.every(t => hs.has(t));
}
function getH2s(html) { return [...html.matchAll(/<h2[^>]*>(.*?)<\/h2>/gis)].map(m => stripTags(m[1])); }
function getLinks(html) {
  return [...html.matchAll(/<a\s[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis)].map(m => ({ href: m[1], anchor: stripTags(m[2]) }));
}

// Compare addresses ignoring protocol, www, ?query, #fragment and a trailing slash.
const linkKey = (u) => String(u || '').split('#')[0].split('?')[0].replace(/^https?:\/\/(www\.)?/i, '').replace(/\/+$/, '').toLowerCase();

// Which of the blog's lead-magnet resources does this HTML link to? Exact address match only.
// The ESC Hub trial IS eschub.com, so a loose "contains" test also counted every link to an
// eschub.com/post/... article as a lead-magnet link.
export function leadMagnetUse(brand, html) {
  const magnets = (BRANDS[brand] && BRANDS[brand].leadMagnets) || [];
  const hits = getLinks(html || '').filter(l => magnets.some(m => linkKey(l.href) === linkKey(m.url)));
  const keys = [...new Set(hits.map(l => magnets.find(m => linkKey(m.url) === linkKey(l.href)).key))];
  return { magnets, hits, keys };
}

// openings: optional list of other posts' openings on this blog ({ title, text }). Without it the
// "too similar to another opening" check is skipped; the stock-phrase check always runs.
export function runChecks({ brand, post, draft, openings }) {
  const b = BRANDS[brand];
  const r = { verdict: 'pass', hard: [], warn: [], pass: [] };
  const HARD = (m) => r.hard.push(m);
  const WARN = (m) => r.warn.push(m);
  const PASS = (m) => r.pass.push(m);

  const html = draft.body_html || '';
  const text = stripTags(html);
  const title = draft.title || '';
  const kw = (post.primary_keyword || '').trim();
  const kwLow = kw.toLowerCase();
  const textLow = text.toLowerCase();

  // 1. Em dashes (hard) / en dashes (warn)
  if (/—/.test(html)) HARD(`Em dash (—) found — replace with " - ".`);
  else PASS('No em dashes.');
  if (/–/.test(html)) WARN(`En dash (–) found — review.`);

  // 2. Banned words & phrases (hard)
  // Scanned everywhere a reader or Google can see words: the article (which includes the FAQ), the
  // headline, the search title and description, the social captions and the FAQ list. It used to
  // look at the article only, which is how "quietly" reached 23 live posts.
  const field = (k) => (draft[k] != null ? draft[k] : (draft.assets || {})[k]);
  const faqList = (field('faq') || []).map(f => `${f.question || ''} ${f.answer || ''}`).join(' ');
  const bannedScopes = [
    ['the article', text],
    ['the headline', title],
    ['the search title', draft.meta_title],
    ['the search description', draft.meta_description],
    ['the social captions', [field('facebook_caption'), field('instagram_caption'), field('pinterest_description')].filter(Boolean).join(' ')],
    ['the FAQ list', faqList],
  ];
  const bannedMsgs = [];
  for (const [where, txt] of bannedScopes) {
    if (!txt) continue;
    const hits = [];
    for (const w of BANNED) { const n = occurrences(txt, w); if (n) hits.push(`${w} (${n})`); }
    for (const p of BANNED_PHRASES) { const n = phraseHits(txt, p); if (n) hits.push(`"${p}" (${n})`); }
    if (hits.length) bannedMsgs.push(`${where}: ${hits.join(', ')}`);
  }
  if (bannedMsgs.length) HARD(`Banned words/phrases in ${bannedMsgs.join('; ')}.`);
  else PASS('No banned words (article, headline, search text, captions, FAQ).');
  for (const s of SPARINGLY) { const n = phraseHits(text, s); if (n > 1) WARN(`"${s}" used ${n}× (max once).`); }

  // 3. Lead-magnet resource link — one contextual link in the body (footer carries the rest)
  const lm = leadMagnetUse(brand, html);
  const lmLabel = (k) => (lm.magnets.find(m => m.key === k) || {}).label || k;
  const chosenMagnet = draft.cta_choice ? lm.magnets.find(m => m.key === draft.cta_choice) : null;
  if (chosenMagnet) {
    // The "Matched CTA link" field and the article's real closing link must agree.
    const others = lm.keys.filter(k => k !== chosenMagnet.key);
    if (!lm.keys.includes(chosenMagnet.key)) HARD(`CTA mismatch: the CTA field says "${chosenMagnet.label}" but the article does not link to it${others.length ? ` (it links to ${others.map(lmLabel).join(', ')} instead)` : ''}. Pick the right one in Matched CTA link and save.`);
    else if (others.length) WARN(`CTA mismatch: the CTA field says "${chosenMagnet.label}" but the article also links to ${others.map(lmLabel).join(', ')}. Check which one you want in Matched CTA link.`);
    else PASS(`Closing link matches the CTA field (${chosenMagnet.label}).`);
  } else if (lm.hits.length === 0) WARN(`No contextual link to a lead magnet (${lm.magnets.map(m => m.label).join(' or ')}).`);
  else PASS(`Lead-magnet link present (${lm.hits.length}).`);
  if (lm.hits.length > 2) WARN(`${lm.hits.length} lead-magnet links, keep it to one contextual mention.`);

  // 4. Voice / person (hard for ESC first-person, warn for NMS).
  // Only AUTHOR narrative counts. Ignore quoted/illustrative spans AND questions —
  // FAQ / reader-voice questions are legitimately first person ("Do I lose my subscribers?",
  // "Can I move my list?") and must not trip the second-person rule.
  const narrativeText = text
    .replace(/["“”][^"“”]*["“”]/g, ' ')   // quoted spans
    .replace(/[^.?!]*\?/g, ' ');          // question clauses (FAQ + reader-voice)
  const firstPersonHits = occurrences(narrativeText, 'I') + occurrences(narrativeText, 'my') + occurrences(narrativeText, 'me');
  if (b.person === 'second') {
    if (firstPersonHits > 2) HARD(`Reads first-person (I/me/my ×${firstPersonHits}) — ESC Hub posts must be second person (you/your).`);
    else PASS('Second-person voice.');
  } else {
    const youHits = occurrences(text, 'you');
    if (firstPersonHits < 3) WARN(`Little first-person voice (I/me/my ×${firstPersonHits}) — NMS posts should be Karen in first person.`);
    else PASS('First-person (Karen) voice.');
  }

  // 4.5 Specific elapsed-time framing (NMS) — the reader could be a few months in or many
  // years in; the tenure itself is never the point, so calling out a specific number/range
  // ("5 to 8 years later", "5-10 years", "3 years in") signals a false assumption about who's
  // reading and excludes anyone outside that window. Vague framing ("however long you've been
  // trying") is fine — only a specific number or numeric range is the problem.
  if (brand === 'nms') {
    const timeHits = [];
    for (const m of text.matchAll(/\b\d+\+?\s*(?:to|-|–|—)\s*\d+\+?\s*(?:years?|yrs?|months?)\b/gi)) timeHits.push(m[0]);
    for (const m of text.matchAll(/\b\d+\+?\s*(?:years?|yrs?|months?)\s+(?:later|ago|in|down the (?:line|road))\b/gi)) timeHits.push(m[0]);
    if (timeHits.length) HARD(`Specific elapsed-time framing found (${[...new Set(timeHits)].join(', ')}) — reader could be months or years in; don't name a number/range.`);
    else PASS('No specific elapsed-time framing.');
  }

  // 5. Forbidden salesy phrases (esc)
  const sell = (b.forbiddenSell || []).filter(p => phraseHits(textLow, p.toLowerCase()));
  if (sell.length) WARN(`Salesy phrasing to remove: ${sell.join(', ')}.`);

  // 6. Forbidden link domains (hard) + internal-link count
  const links = getLinks(html);
  const badDomain = links.filter(l => (b.forbiddenLinkDomains || []).some(d => l.href.includes(d)));
  if (badDomain.length) HARD(`Links to forbidden domains: ${badDomain.map(l => l.href).join(', ')}.`);
  const sameBlogHost = b.blogIndex.split('/')[0];
  // Links to OTHER posts only: an article path on this blog. The lead-magnet link (for example
  // the ESC Hub trial, or the Reality Check on escapepreneur.com) is a different thing and must
  // not be counted here, or the two checks fight each other.
  const internal = links.filter(l => { const k = linkKey(l.href); return k.startsWith(sameBlogHost + '/post/') || k.startsWith('/post/'); });
  if (internal.length < 3) WARN(`Only ${internal.length} in-body internal link(s) — need 3 to other ${b.name} posts.`);
  else PASS(`${internal.length} internal links.`);
  if (links.some(l => /^(click here|read more|here)$/i.test(l.anchor))) WARN('Generic anchor text ("click here"/"read more") found.');

  // 7. Keyword placement
  if (kw) {
    if (keywordPresent(title, kw)) PASS('Keyword in H1 title.'); else HARD(`Primary keyword "${kw}" not in the H1 title.`);
    if (keywordPresent(firstWords(textLow, 100), kw)) PASS('Keyword in first 100 words.'); else WARN(`Keyword not in first 100 words.`);
    const inH2 = getH2s(html).some(h => keywordPresent(h, kw));
    inH2 ? PASS('Keyword in an H2.') : WARN('Keyword not in any H2 subheading.');
    const kwN = phraseHits(textLow, kwLow);
    if (kwN < 3) WARN(`Keyword used ${kwN}× — aim for 3-5.`);
    else if (kwN > 6) WARN(`Keyword used ${kwN}× — may be stuffed (aim 3-5).`);
    else PASS(`Keyword used ${kwN}×.`);
  }

  // 8. H2 structure
  const h2s = getH2s(html);
  if (h2s.length < 2) WARN(`Only ${h2s.length} H2 subheading(s).`); else PASS(`${h2s.length} H2 subheadings.`);

  // 9. Meta title / description
  const mt = (draft.meta_title || '').length;
  if (mt < 50 || mt > 60) WARN(`Meta title ${mt} chars (need 50-60).`); else PASS('Meta title length OK.');
  if (!keywordPresent(draft.meta_title || '', kw)) WARN('Keyword not in meta title.');
  const md = (draft.meta_description || '').length;
  if (md < 150 || md > 160) WARN(`Meta description ${md} chars (need 150-160).`); else PASS('Meta description length OK.');
  if (!keywordPresent(draft.meta_description || '', kw)) WARN('Keyword not in meta description.');

  // 10. Slug
  const slug = draft.slug || '';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) WARN(`Slug "${slug}" should be lowercase words joined by hyphens.`); else PASS('Slug format OK.');
  // The web address must contain the primary keyword's words (small words like "a" or "for" may
  // be dropped, as the writer does). Red, so a slug that went stale when the keyword changed is
  // caught before the post is scheduled.
  if (kw) {
    // Plural-tolerant: coaches/coach, templates/template, processes/process, but business stays business.
    const stem = (w) => w.replace(/ies$/, 'y').replace(/(ch|sh|ss|x|z)es$/, '$1').replace(/([^s])s$/, '$1');
    // Small and question words are normally left out of an address ("what is a vision board" ->
    // what-a-vision-board), so they don't count as missing.
    const SLUG_SKIP = new Set([...KW_STOP, 'is', 'are', 'was', 'be', 'what', 'how', 'why', 'do', 'does', 'can', 'should', 'i', 'you', 'it']);
    const toks = (s) => (String(s || '').toLowerCase().match(/[a-z0-9]+/g) || []).filter(w => !SLUG_SKIP.has(w)).map(stem);
    const slugWords = new Set(toks(slug));
    const missing = toks(kw).filter(t => !slugWords.has(t));
    if (missing.length) HARD(`The slug "${slug}" does not contain the primary keyword "${kw}" (missing: ${missing.join(', ')}). Edit the slug in the Draft tab.`);
    else PASS('The slug contains the primary keyword.');
  }

  // 11. TOC marker after intro, before first H2
  const tocIdx = html.indexOf('<!-- TOC -->');
  const firstH2Idx = html.search(/<h2[^>]*>/i);
  if (tocIdx === -1) WARN('TOC marker <!-- TOC --> missing.');
  else if (firstH2Idx !== -1 && tocIdx > firstH2Idx) WARN('TOC marker is after the first H2 — move it before.');
  else if (tocIdx < 200) WARN('TOC marker is too high — it should sit after the intro.');
  else PASS('TOC marker positioned after intro.');

  // 12. Word count
  const wc = wordCount(text);
  if (wc < b.wordMin) WARN(`Word count ${wc} — below ${b.wordMin}.`);
  else if (wc > b.wordMax) WARN(`Word count ${wc} — above ${b.wordMax}.`);
  else PASS(`Word count ${wc}.`);

  // 13. AI-citation (GEO) signals
  const h3s = [...html.matchAll(/<h3[^>]*>(.*?)<\/h3>/gis)].map(m => stripTags(m[1]));
  if (/frequently asked questions/i.test(text) || /<h2[^>]*>\s*faq/i.test(html)) PASS('FAQ section present.');
  else WARN('No FAQ section — add one for AI citation.');
  const external = links.filter(l => /^https?:\/\//i.test(l.href)
    && !l.href.includes(sameBlogHost)
    && !(b.allowedLinkDomains || []).some(d => l.href.includes(d))
    && !(b.forbiddenLinkDomains || []).some(d => l.href.includes(d)));
  if (external.length) PASS(`${external.length} external citation link(s).`);
  else WARN('No external citation/source link — cite a reputable source for AI trust.');
  if ([...h2s, ...h3s].some(hd => hd.trim().endsWith('?'))) PASS('Question-style heading(s) present.');
  else WARN('No question-style headings — AI search favours them.');

  // 14. Opening: no stock phrases, and not a copy of another post's opening (amber, a judgment call).
  const stock = openingPhraseHits(html);
  if (stock.length) WARN(`The opening leans on a stock phrase (${stock.map(p => `"${p}"`).join(', ')}). Open on a specific moment or feeling instead.`);
  else PASS('The opening avoids the stock phrases.');
  if (Array.isArray(openings)) {
    const near = similarOpenings(html, openings);
    if (near.length) WARN(`The opening ${near.map(n => `${n.why} "${n.title}"`).join(' and ')}. Try a different angle so posts don't all start the same way.`);
    else PASS('The opening is different from the other posts on this blog.');
  }

  r.verdict = r.hard.length ? 'fail' : (r.warn.length ? 'review' : 'pass');
  r.wordCount = wc;
  return r;
}
