// Pinterest publishing via GHL's Social Planner API (no Blotato). Each published post pins
// to the best-matching TOPIC board + the brand's BLOG board (Karen's relevant->blog flow),
// on the correct brand account. GHL create-post: pinterestPostDetails.boardIds = {accountId: boardId},
// media = {url, type:"image/jpeg"}, description = post summary, link+title in pinterestPostDetails.
const GHL = 'https://services.leadconnectorhq.com';
const LOC = process.env.GHL_LOCATION_ID || 'EoD3KT6IiKx0oIXjInOt';

// Per-brand Pinterest account id (GHL) + board name->id map (Pinterest-native ids). GHL's
// board-list endpoint is scope-gated for our token, so these are maintained here; add a row
// if you create a new board you want auto-pinning to use.
const PIN = {
  esc: {
    account: '69e7ae9ef460db52ae19f6fc_EoD3KT6IiKx0oIXjInOt_1109785670584800857_profile',
    blogBoard: '1109785601867074947', // ESC Hub - Blog
    boards: [
      { name: 'All-in-One Business Software', id: '1109785601867074937' },
      { name: 'Business Automation Tips', id: '1109785601867074936' },
      { name: 'Business Tools for Solopreneurs', id: '1109785601867074930' },
      { name: 'Client Onboarding Tips', id: '1109785601867074935' },
      { name: 'CRM for Coaches', id: '1109785601867074933' },
      { name: 'Email Marketing Automation', id: '1109785601867074934' },
      { name: 'Freedom Lifestyle Business', id: '1109785601867074940' },
      { name: 'Mindset Motivation Entrepreneurs', id: '1109785601867074946' },
      { name: 'Online Business for Mums', id: '1109785601867074941' },
      { name: 'Work From Anywhere', id: '1109785601867074942' },
    ],
  },
  nms: {
    account: '6a41fbb255005128f85f2929_EoD3KT6IiKx0oIXjInOt_1095571184260938217_profile',
    blogBoard: '1095571115543210748', // No More Somedays - Blog
    boards: [
      { name: 'Digital Nomad Life', id: '1095571115543210764' },
      { name: 'Freedom Lifestyle Design', id: '1095571115543210750' },
      { name: 'Location Independent Living', id: '1095571115543210755' },
      { name: 'Mindset Motivation', id: '1095571115543210757' },
      { name: 'Online Business for Women', id: '1095571115543210752' },
      { name: 'The Escapepreneur Life', id: '1095571115543210758' },
      { name: 'Travel Work', id: '1095571115543210763' },
      { name: 'Women in Business', id: '1095571115543210762' },
      { name: 'Work From Anywhere', id: '1095571115543210760' },
    ],
  },
};

export const pinterestConfigured = (pit) => !!pit;
const H = (pit) => ({ Authorization: `Bearer ${pit}`, Version: '2021-07-28', 'Content-Type': 'application/json', Accept: 'application/json' });

// GHL create-post requires a userId — reuse the createdBy of any existing post.
export async function getGhlUserId(pit) {
  const r = await fetch(`${GHL}/social-media-posting/${LOC}/posts/list`, { method: 'POST', headers: H(pit), body: '{}' });
  const d = await r.json().catch(() => ({}));
  const posts = d.posts || (d.results && d.results.posts) || [];
  return posts.map(p => p.createdBy).find(Boolean) || null;
}

const words = (s) => (String(s || '').toLowerCase().match(/[a-z0-9]+/g) || []);
const STOP = new Set(['the', 'for', 'and', 'a', 'to', 'of', 'in', 'on', 'your', 'with', 'blog', 'business', 'how', 'what', 'why']);
// Best topic board by keyword overlap between the post and board names.
function pickTopicBoard(brand, post) {
  const cfg = PIN[brand];
  const terms = new Set([...words(post.primary_keyword), ...words(post.title), ...words(post.cluster)].filter(w => w.length > 2 && !STOP.has(w)));
  let best = null, score = 0;
  for (const b of cfg.boards) {
    let s = 0; words(b.name).filter(w => !STOP.has(w)).forEach(w => { if (terms.has(w)) s++; });
    if (s > score) { score = s; best = b; }
  }
  return score >= 1 ? best : null;
}

async function createPin({ pit, brand, userId, boardId, title, summary, link, imageUrl }) {
  const cfg = PIN[brand];
  const body = {
    accountIds: [cfg.account], type: 'post', status: 'published', userId,
    summary: summary || '',
    media: [{ url: imageUrl, type: 'image/jpeg' }],
    pinterestPostDetails: { boardIds: { [cfg.account]: boardId }, link: link || '', title: (title || '').slice(0, 100) },
  };
  const r = await fetch(`${GHL}/social-media-posting/${LOC}/posts`, { method: 'POST', headers: H(pit), body: JSON.stringify(body) });
  const t = await r.text();
  if (!r.ok) throw new Error(`GHL pin ${r.status}: ${t.slice(0, 200)}`);
  return true;
}

// Post a post's pin to its topic board + brand blog board. Returns { posted:[{board}], skipped? }.
export async function postPinsForPost({ pit, userId, brand, post, draft }) {
  const cfg = PIN[brand];
  if (!cfg || !pit) return { skipped: 'no config or token' };
  const assets = (draft && draft.assets) || {};
  const imageUrl = assets.pin_image_url;
  if (!imageUrl) return { skipped: 'no pin image yet' };
  const title = (assets.title || post.title || post.primary_keyword || '').slice(0, 100);
  const summary = assets.pinterest_description || draft.meta_description || title;
  const link = post.url || '';
  const topic = pickTopicBoard(brand, post);
  const targets = [];
  if (topic) targets.push({ id: topic.id, name: topic.name });
  targets.push({ id: cfg.blogBoard, name: 'blog board' });
  const posted = [];
  const seen = new Set();
  for (const b of targets) {
    if (seen.has(b.id)) continue; seen.add(b.id);
    try { await createPin({ pit, brand, userId, boardId: b.id, title, summary, link, imageUrl }); posted.push({ board: b.name }); }
    catch (e) { posted.push({ board: b.name, error: String(e && e.message || e) }); }
  }
  return { posted, topicBoard: topic && topic.name };
}
