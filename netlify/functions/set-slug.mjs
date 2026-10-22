// POST { post_id, slug } with "Authorization: Bearer <Blog Studio session token>"
// Changes a post's web address (slug) until it goes live. Before it is sent to ESC Hub, only the
// saved draft changes (scheduling reads the slug from it). Once it is scheduled (sent to ESC Hub as a
// draft, going live on its date), the address is also changed in ESC Hub, together with its canonical
// address, so ESC Hub and the tracker stay in step and the daily Search Console check has no dead address.
// If other unsent drafts link to the old address (cluster posts link to each other by their
// reserved addresses), those links are updated to the new one so they don't break.
import { requireUser } from './_lib/auth.mjs';
import { slugExists, publicUrl, getBlogPostDetail, updateBlogPost } from './_lib/ghl.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpprrknnkjyluhgtoezu.supabase.co';
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PIT = process.env.GHL_API_TOKEN;
const json = (c, o) => ({ statusCode: c, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  if (!SKEY) return json(500, { error: 'Server not configured (SUPABASE_SERVICE_ROLE_KEY).' });
  const denied = await requireUser(event);
  if (denied) return json(denied.status, { error: denied.error });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'invalid JSON' }); }
  const { post_id } = body;
  const slug = String(body.slug || '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(String(post_id || ''))) return json(400, { error: 'post_id required' });
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 3 || slug.length > 80) {
    return json(400, { error: 'The slug can only use lowercase letters, numbers and single hyphens between words (3 to 80 characters).' });
  }

  const h = { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'content-type': 'application/json' };
  const rest = (q, opts = {}) => fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: h, ...opts });

  try {
    const [post] = await (await rest(`posts?id=eq.${post_id}&select=id,blog,status,ghl_post_id`)).json();
    const [draft] = await (await rest(`post_drafts?post_id=eq.${post_id}&select=post_id,slug`)).json();
    if (!post || !draft) return json(404, { error: 'post or draft not found' });
    if (post.status === 'live') return json(409, { error: 'This post is already live, so its web address can no longer be changed here.' });
    if (post.ghl_post_id && post.status !== 'scheduled') return json(409, { error: 'This post has already been sent to ESC Hub and is not scheduled, so its web address cannot be changed here.' });
    if (post.ghl_post_id && !PIT) return json(500, { error: 'Server not configured (GHL_API_TOKEN), so the address cannot be changed in ESC Hub.' });
    const old = draft.slug || '';
    if (slug === old) return json(200, { ok: true, slug, unchanged: true, url: publicUrl(post.blog, slug), links_updated: 0, locked_links: [] });

    // Not already taken by another post on this blog (tracker drafts, tracker URLs, or ESC Hub).
    const sameDrafts = await (await rest(`post_drafts?slug=eq.${slug}&post_id=neq.${post_id}&select=post_id`)).json();
    if (Array.isArray(sameDrafts) && sameDrafts.length) {
      const owners = await (await rest(`posts?id=in.(${sameDrafts.map(d => d.post_id).join(',')})&blog=eq.${post.blog}&select=id`)).json();
      if (Array.isArray(owners) && owners.length) return json(409, { error: `Another post on this blog already uses the address "${slug}".` });
    }
    const sameUrl = await (await rest(`posts?blog=eq.${post.blog}&id=neq.${post_id}&url=like.*/post/${slug}&select=id`)).json();
    if (Array.isArray(sameUrl) && sameUrl.length) return json(409, { error: `A published post on this blog already uses the address "${slug}".` });
    if (PIT && (await slugExists({ brand: post.blog, slug, pit: PIT })) === true) return json(409, { error: `The address "${slug}" is already taken in ESC Hub.` });

    // Scheduled: change it in ESC Hub first (it is still a draft there), then the tracker. If ESC Hub
    // refuses, nothing in the tracker has changed, so the two cannot drift apart.
    const newUrl = publicUrl(post.blog, slug);
    let ghlDetail = null;
    if (post.ghl_post_id) {
      ghlDetail = await getBlogPostDetail({ ghlPostId: post.ghl_post_id, pit: PIT });
      if (String(ghlDetail.status || '').toUpperCase() !== 'DRAFT') return json(409, { error: 'This post is already published in ESC Hub, so its web address can no longer be changed here.' });
      await updateBlogPost({ ghlPostId: post.ghl_post_id, brand: post.blog, pit: PIT, current: ghlDetail, urlSlug: slug, canonicalLink: newUrl });
      const after = await getBlogPostDetail({ ghlPostId: post.ghl_post_id, pit: PIT });
      if (after.urlSlug !== slug) {
        try { await updateBlogPost({ ghlPostId: post.ghl_post_id, brand: post.blog, pit: PIT, current: after, urlSlug: ghlDetail.urlSlug, canonicalLink: ghlDetail.canonicalLink }); } catch { /* best-effort restore */ }
        return json(500, { error: `ESC Hub did not accept the address (it stored "${after.urlSlug}"). Nothing was changed.` });
      }
    }
    const w = await rest(`post_drafts?post_id=eq.${post_id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ slug }) });
    if (!w.ok) return json(500, { error: `could not save the slug: ${w.status}${post.ghl_post_id ? ' (ESC Hub already has the new address, so tell Karen before trying again)' : ''}` });
    if (post.ghl_post_id) {
      const u = await rest(`posts?id=eq.${post_id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ url: newUrl }) });
      if (!u.ok) return json(500, { error: `ESC Hub and the draft have the new address but the tracker's link did not update: ${u.status}. Tell Karen.` });
    }

    // Other unsent drafts that link to the old address: point them at the new one.
    let updated = 0;
    if (old) {
      const unsent = await (await rest(`posts?blog=eq.${post.blog}&ghl_post_id=is.null&id=neq.${post_id}&select=id`)).json();
      const ids = (Array.isArray(unsent) ? unsent : []).map(p => p.id);
      if (ids.length) {
        const candidates = await (await rest(`post_drafts?post_id=in.(${ids.join(',')})&body_html=ilike.*/post/${old}*&select=post_id,body_html,internal_links`)).json();
        const re = new RegExp(`(/post/)${esc(old)}(?=["'#?/\\s<])`, 'g');
        for (const d of (Array.isArray(candidates) ? candidates : [])) {
          const nb = String(d.body_html || '').replace(re, `$1${slug}`);
          const nl = d.internal_links ? JSON.parse(JSON.stringify(d.internal_links).replace(re, `$1${slug}`)) : d.internal_links;
          if (nb !== d.body_html) {
            const r = await rest(`post_drafts?post_id=eq.${d.post_id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ body_html: nb, internal_links: nl }) });
            if (r.ok) updated++;
          }
        }
      }
    }
    // Posts already sent to ESC Hub have bodies that cannot be edited from here. List any that link to the old address.
    let locked_links = [];
    if (old) {
      const sent = await (await rest(`posts?blog=eq.${post.blog}&ghl_post_id=not.is.null&id=neq.${post_id}&select=id,title,url`)).json();
      const sids = (Array.isArray(sent) ? sent : []).map(p => p.id);
      if (sids.length) {
        const hits = await (await rest(`post_drafts?post_id=in.(${sids.join(',')})&body_html=ilike.*/post/${old}*&select=post_id,body_html`)).json();
        const re2 = new RegExp(`/post/${esc(old)}(?=["'#?/\\s<])`);
        const hitIds = new Set((Array.isArray(hits) ? hits : []).filter(d => re2.test(String(d.body_html || ''))).map(d => d.post_id));
        locked_links = sent.filter(p => hitIds.has(p.id)).map(p => ({ title: p.title, url: p.url }));
      }
    }
    return json(200, { ok: true, slug, url: newUrl, links_updated: updated, ghl_updated: !!post.ghl_post_id, locked_links });
  } catch (e) {
    return json(500, { error: String(e && e.message || e) });
  }
};
