// Login links by email via Resend (https://resend.com). One HTTP call, no SDK.
export async function sendLoginLink(to, link) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) throw new Error('RESEND_API_KEY and EMAIL_FROM must be set');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to,
      subject: 'Your CMD + SHIFT + CASH login link',
      html: `<p>Tap to sign in. The link works for 30 minutes.</p>
<p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#16a34a;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Sign in</a></p>
<p style="color:#666;font-size:13px">If you didn't ask for this, ignore this email.</p>`,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`email failed: HTTP ${res.status}`);
}
