// Auto-links the first mention of GoHighLevel / HighLevel in a post body to Karen's
// affiliate link (40% recurring). Applied at publish time in createBlogPost.
// - First mention only: linking every occurrence is spammy and Google discounts it.
// - rel="sponsored nofollow": Google REQUIRES affiliate links to be tagged this way.
// - Skips any mention already inside an <a> (won't double-link existing anchors).
export const AFFILIATE_URL = 'https://www.gohighlevel.com/?fp_ref=gsp';

export function affiliateLinkify(html, url = AFFILIATE_URL) {
  if (!html) return html;
  const anchors = [];
  // protect existing anchors so we never link inside one (collision-safe token)
  let s = String(html).replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, (m) => { anchors.push(m); return `@@AFFANCHOR${anchors.length - 1}@@`; });
  // link the FIRST branded mention (GoHighLevel preferred over the bare HighLevel)
  s = s.replace(/\b(GoHighLevel|Go High Level|HighLevel)\b/, (m) => `<a href="${url}" rel="sponsored nofollow" target="_blank">${m}</a>`);
  // restore protected anchors
  s = s.replace(/@@AFFANCHOR(\d+)@@/g, (_, i) => anchors[+i]);
  return s;
}
