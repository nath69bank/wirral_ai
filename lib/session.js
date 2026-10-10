// Signed tokens for the member cookie and email login links. HMAC-SHA256 over
// a base64url JSON payload; no database needed.
import { createHmac, timingSafeEqual } from 'node:crypto';

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET must be set to at least 32 characters');
  return s;
}

const mac = (data) => createHmac('sha256', secret()).update(data).digest('base64url');

export function sign(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${data}.${mac(data)}`;
}

// Returns the payload, or null if the token is malformed, forged or (unless
// allowExpired) expired.
export function verify(token, { allowExpired = false } = {}) {
  if (typeof token !== 'string') return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  const expected = Buffer.from(mac(data));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (typeof payload.exp !== 'number') return null;
    if (!allowExpired && payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}
