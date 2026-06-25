// Pexels stock-photo search. Returns up to n landscape candidates for a term.
// Free API (commercial use allowed). Fails soft -> returns [] so generation never breaks.
export async function searchPexels(term, apiKey, n = 3, page = 1) {
  if (!apiKey || !term) return [];
  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(term)}&per_page=${n}&page=${page}&orientation=landscape`;
    const res = await fetch(url, { headers: { Authorization: apiKey } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.photos || []).map(p => ({
      url: p.src?.large || p.src?.medium || p.src?.original,
      thumb: p.src?.tiny || p.src?.small || p.src?.medium,
      alt: p.alt || term,
      photographer: p.photographer || '',
      pexels: p.url || '',
    }));
  } catch (e) { return []; }
}
