// Mechanical brand/SEO checker. Deterministic rules only — the editorial
// judgement (anti-puff / beginner / "does it work") is a separate Claude pass.
// Returns a structured report: { verdict, hard:[], warn:[], pass:[] }.
// hard = blocks approval; warn = surfaced for the reviewer; pass = confirmed-clean.

import { BRANDS, BANNED, BANNED_PHRASES, SPARINGLY } from './brands.mjs';

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

export function runChecks({ brand, post, draft }) {
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
  const bannedHits = [];
  for (const w of BANNED) { const n = occurrences(text, w); if (n) bannedHits.push(`${w} (${n})`); }
  for (const p of BANNED_PHRASES) { const n = phraseHits(text, p); if (n) bannedHits.push(`"${p}" (${n})`); }
  if (bannedHits.length) HARD(`Banned words/phrases: ${bannedHits.join(', ')}.`);
  else PASS('No banned words.');
  for (const s of SPARINGLY) { const n = phraseHits(text, s); if (n > 1) WARN(`"${s}" used ${n}× (max once).`); }

  // 3. Lead-magnet resource link — one contextual link in the body (footer carries the rest)
  const lmUrls = (b.leadMagnets || []).map(m => m.url.replace(/^https?:\/\//, ''));
  const lmLinks = getLinks(html).filter(l => lmUrls.some(u => l.href.includes(u)));
  if (lmLinks.length === 0) WARN(`No contextual link to a lead magnet (${(b.leadMagnets || []).map(m => m.label).join(' or ')}).`);
  else if (lmLinks.length > 2) WARN(`${lmLinks.length} lead-magnet links — keep it to one contextual mention.`);
  else PASS(`Lead-magnet link present (${lmLinks.length}).`);

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

  // 5. Forbidden salesy phrases (esc)
  const sell = (b.forbiddenSell || []).filter(p => phraseHits(textLow, p.toLowerCase()));
  if (sell.length) WARN(`Salesy phrasing to remove: ${sell.join(', ')}.`);

  // 6. Forbidden link domains (hard) + internal-link count
  const links = getLinks(html);
  const badDomain = links.filter(l => (b.forbiddenLinkDomains || []).some(d => l.href.includes(d)));
  if (badDomain.length) HARD(`Links to forbidden domains: ${badDomain.map(l => l.href).join(', ')}.`);
  const sameBlogHost = b.blogIndex.split('/')[0];
  const internal = links.filter(l => l.href.includes(sameBlogHost) && !/\/blog\/?$/.test(l.href));
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

  r.verdict = r.hard.length ? 'fail' : (r.warn.length ? 'review' : 'pass');
  r.wordCount = wc;
  return r;
}
