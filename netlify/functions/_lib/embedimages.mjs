// Inject the chosen (or top) body images into the article HTML right before it
// goes to GHL. GHL strips classes/<style>, so use inline styles only.
// Images are spread across the article's <h2> sections (skipping the first, so the
// opening image doesn't land in the intro/TOC zone). Falls back to appending if
// there aren't enough headings.
export function embedBodyImages(html, bodyImages) {
  if (!html) return html;
  const figs = (bodyImages || []).map(slot => {
    if (!slot) return null;
    const url = slot.chosen || (slot.candidates && slot.candidates[0] && slot.candidates[0].url);
    if (!url) return null;
    const cand = (slot.candidates || []).find(c => c.url === url) || (slot.candidates || [])[0] || {};
    const alt = String(cand.alt || slot.term || '').replace(/"/g, '&quot;');
    return `<figure style="margin:28px 0"><img src="${url}" alt="${alt}" style="display:block;width:100%;height:auto;border-radius:8px"/></figure>`;
  }).filter(Boolean);
  if (!figs.length) return html;

  const h2s = [];
  const re = /<h2\b/gi; let m;
  while ((m = re.exec(html))) h2s.push(m.index);
  const eligible = h2s.slice(1); // keep the first image out of the intro/TOC zone
  if (!eligible.length) return html + figs.join('');

  const step = eligible.length / figs.length;
  const used = new Set(), inserts = [], leftover = [];
  for (let i = 0; i < figs.length; i++) {
    const at = eligible[Math.min(eligible.length - 1, Math.floor(i * step))];
    if (used.has(at)) { leftover.push(figs[i]); continue; }
    used.add(at); inserts.push({ at, html: figs[i] });
  }
  let out = html;
  inserts.sort((a, b) => b.at - a.at).forEach(ins => { out = out.slice(0, ins.at) + ins.html + out.slice(ins.at); });
  if (leftover.length) out += leftover.join('');
  return out;
}
