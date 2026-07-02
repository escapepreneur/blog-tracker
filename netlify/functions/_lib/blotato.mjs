// Pinterest publishing via Blotato REST v2. Needs BLOTATO_API_KEY.
// Each published post pins to: the best-matching TOPIC board + the brand's BLOG board
// (Karen's manual relevant->blog flow). Brand-correct: esc uses the ESC Hub Pinterest
// account, nms the Escapepreneur one — never crosses brands.
const BASE = 'https://backend.blotato.com/v2';
const KEY = process.env.BLOTATO_API_KEY;

// Blotato Pinterest account ids per brand (GET /v2/users/me/accounts?platform=pinterest).
const ACCOUNTS = { esc: '7859', nms: '7435' }; // 7859 = eschubsoftware, 7435 = escapepreneur

export const blotatoConfigured = () => !!KEY;

async function bl(path, opts = {}) {
  const r = await fetch(BASE + path, { ...opts, headers: { 'blotato-api-key': KEY, 'content-type': 'application/json', ...(opts.headers || {}) } });
  const t = await r.text();
  let d = {}; try { d = JSON.parse(t); } catch {}
  if (!r.ok) throw new Error(`blotato ${path} ${r.status}: ${t.slice(0, 200)}`);
  return d;
}

export async function listBoards(brand) {
  const acct = ACCOUNTS[brand];
  if (!acct) return [];
  const d = await bl(`/social/pinterest/boards?accountId=${acct}`);
  return (d.items || []).map(b => ({ id: b.id, name: b.name }));
}

async function publishPin({ brand, boardId, title, text, link, imageUrl, altText }) {
  const acct = ACCOUNTS[brand];
  return bl('/posts', {
    method: 'POST',
    body: JSON.stringify({
      post: {
        accountId: acct,
        content: { text: text || '', mediaUrls: [imageUrl], platform: 'pinterest' },
        target: { targetType: 'pinterest', boardId, title: (title || '').slice(0, 100), altText: (altText || title || '').slice(0, 500), link: link || '' },
      },
    }),
  });
}

const words = (s) => (String(s || '').toLowerCase().match(/[a-z0-9]+/g) || []);
// Pick the brand blog board + the best topic board for this post.
function pickBoards(brand, boards, post) {
  const blog = boards.find(b => /blog/i.test(b.name) && (brand === 'esc' ? /esc/i.test(b.name) : /somedays|escapepreneur/i.test(b.name)))
    || boards.find(b => /blog/i.test(b.name)) || null;
  const stop = new Set(['the', 'for', 'and', 'a', 'to', 'of', 'in', 'on', 'your', 'with', 'blog', 'business']);
  const terms = new Set([...words(post.primary_keyword), ...words(post.title), ...words(post.cluster)].filter(w => w.length > 2 && !stop.has(w)));
  let best = null, score = 0;
  for (const b of boards) {
    if (blog && b.id === blog.id) continue;
    const bw = words(b.name).filter(w => !stop.has(w));
    let s = 0; bw.forEach(w => { if (terms.has(w)) s++; });
    if (s > score) { score = s; best = b; }
  }
  return { blog, topic: score >= 1 ? best : null };
}

// Post a post's pin to its topic + blog boards. Returns { posted:[{board}], skipped? }.
export async function postPinsForPost({ brand, post, draft }) {
  if (!blotatoConfigured()) return { skipped: 'no BLOTATO_API_KEY' };
  const assets = (draft && draft.assets) || {};
  const imageUrl = assets.pin_image_url;
  if (!imageUrl) return { skipped: 'no pin image yet' };
  const boards = await listBoards(brand);
  if (!boards.length) return { skipped: 'no boards returned' };
  const { blog, topic } = pickBoards(brand, boards, post);
  const title = (assets.title || post.title || post.primary_keyword || '').slice(0, 100);
  const text = assets.pinterest_description || draft.meta_description || title;
  const link = post.url || '';
  const posted = [];
  const seen = new Set();
  for (const board of [topic, blog].filter(Boolean)) {
    if (seen.has(board.id)) continue; seen.add(board.id);
    try { await publishPin({ brand, boardId: board.id, title, text, link, imageUrl, altText: title }); posted.push({ board: board.name }); }
    catch (e) { posted.push({ board: board.name, error: String(e && e.message || e) }); }
  }
  return { posted, blogBoard: blog && blog.name, topicBoard: topic && topic.name };
}
