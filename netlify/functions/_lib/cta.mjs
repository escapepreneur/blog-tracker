// Turn the plain-text CTA at the end of the article into a prominent, clickable
// button before publishing to GHL. The generator writes the CTA as the final
// paragraph worded "<action> at <url>" (plain text), so it isn't a live link and
// gets lost at the bottom. We keep any lead-in sentence and replace the bare CTA
// with a centered teal button linking to the brand's CTA URL. Inline styles only
// (GHL strips classes/<style>).
import { BRANDS } from './brands.mjs';

export function styleCta(html, brand) {
  if (!html) return html;
  const b = BRANDS[brand];
  if (!b || !b.cta) return html;
  const url = 'https://' + String(b.ctaUrl || '').replace(/^https?:\/\//, '');
  const action = (b.cta.split(/\s+at\s+/i)[0] || b.cta).trim();
  const button = `<p style="text-align:center;margin:38px 0 8px"><a href="${url}" style="display:inline-block;background:#29abab;color:#ffffff;font-weight:700;font-size:17px;text-decoration:none;padding:15px 34px;border-radius:10px">${action} &rarr;</a></p>`;

  // locate the last <p>…</p> (the CTA paragraph)
  const re = /<p\b[^>]*>[\s\S]*?<\/p>/gi;
  let m, last = null;
  while ((m = re.exec(html))) last = m;
  if (last) {
    const inner = last[0].replace(/^<p\b[^>]*>/i, '').replace(/<\/p>\s*$/i, '');
    const text = inner.replace(/<[^>]+>/g, '');
    const idx = text.toLowerCase().indexOf(action.toLowerCase());
    if (idx >= 0) {
      const lead = text.slice(0, idx).trim().replace(/[\s,;:.–-]+$/, '');
      const replacement = (lead ? `<p>${lead}</p>` : '') + button;
      return html.slice(0, last.index) + replacement + html.slice(last.index + last[0].length);
    }
  }
  return html + button; // CTA phrase not found in the last paragraph -> just append the button
}
