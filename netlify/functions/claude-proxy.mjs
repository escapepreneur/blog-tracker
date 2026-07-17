// Thin server-side proxy for the dashboard's ad-hoc Claude calls (keyword ranking, link
// suggestions, live-post review, content-gap finder). These used to call api.anthropic.com
// directly from the browser with a key pasted into each person's localStorage — this proxy
// lets every logged-in account share the one ANTHROPIC_API_KEY already configured in Netlify
// env, same as the other AI features, so nobody has to hold their own key.
const AKEY = process.env.ANTHROPIC_API_KEY;
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  if (!AKEY) return json(500, { error: 'ANTHROPIC_API_KEY not configured.' });
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'bad JSON' }); }
  const { model, max_tokens, messages, tools } = body;
  if (!model || !max_tokens || !Array.isArray(messages)) return json(400, { error: 'model, max_tokens, messages required' });

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': AKEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens, messages, ...(tools ? { tools } : {}) }),
    });
    const data = await res.json();
    if (!res.ok) return json(res.status, { error: data?.error?.message || `Anthropic ${res.status}` });
    return json(200, data);
  } catch (e) {
    return json(502, { error: String(e && e.message || e) });
  }
};
