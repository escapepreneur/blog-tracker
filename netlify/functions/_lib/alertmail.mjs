// Sends Karen an alert email through Resend. Used by the 16:00 SAST watchdog and by the
// GitHub late-publish backstop. Throws if it cannot send, so a missing key shows up as a
// failed run instead of a silent no-op.
const TRACKER = 'https://blog.escapepreneur.com';

export function alertHtml({ intro, items, note }) {
  return `<div style="font-family:system-ui,sans-serif;font-size:15px;color:#143434;line-height:1.6">
  <p>${intro}</p>
  <ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>
  <p><a href="${TRACKER}" style="display:inline-block;background:#1AA3A0;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Open Blog Studio →</a></p>
  ${note ? `<p style="font-size:12px;color:#5b7373">${note}</p>` : ''}
</div>`;
}

export async function sendAlert({ subject, html }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set, so the alert email could not be sent');
  const to = (process.env.REMINDER_EMAIL || 'karen@escapepreneur.com').split(',').map(s => s.trim()).filter(Boolean);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: 'Blog Studio <onboarding@resend.dev>', to, subject, html }),
  });
  if (!res.ok) throw new Error(`Resend send failed ${res.status}: ${(await res.text()).slice(0, 300)}`);
}
