// Shared by the functions that only a signed-in Blog Studio user may call. The browser sends its
// Supabase session token as "Authorization: Bearer <token>"; Supabase confirms it is real.
// Returns null when the caller is signed in, otherwise { status, error } to send back.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vpprrknnkjyluhgtoezu.supabase.co';
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function requireUser(event) {
  const token = String((event.headers && (event.headers.authorization || event.headers.Authorization)) || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return { status: 401, error: 'Please sign in to Blog Studio again.' };
  const who = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SKEY, Authorization: `Bearer ${token}` } }).catch(() => null);
  if (!who || !who.ok) return { status: 401, error: 'Your sign-in has expired. Refresh the page and sign in again.' };
  return null;
}
