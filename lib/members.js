// Membership = an active Stripe subscription. The member cookie stores the
// Stripe customer id and the paid-up-to time, so most page loads need no
// Stripe call; once that time passes we re-check and reissue.
import Stripe from 'stripe';
import { sign, verify } from './session.js';
import { cookies } from './http.js';

export const COOKIE = 'csc_member';
const ACTIVE = new Set(['active', 'trialing']);

let stripe;
function api() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not set');
  stripe ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripe;
}

// Newer Stripe API versions moved current_period_end onto subscription items.
const periodEnd = (sub) => sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end ?? 0;

// Returns the paid-up-to unix time for a customer, or 0 if not a member.
export async function paidUntil(customerId) {
  const subs = await api().subscriptions.list({ customer: customerId, status: 'all', limit: 10 });
  return Math.max(0, ...subs.data.filter((s) => ACTIVE.has(s.status)).map(periodEnd));
}

export async function createCheckout(base) {
  if (!process.env.STRIPE_PRICE_ID) throw new Error('STRIPE_PRICE_ID is not set');
  const session = await api().checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${base}/api/auth?action=return&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/#join`,
  });
  return session.url;
}

// After checkout: returns the customer id if the session paid for a live subscription.
export async function customerFromCheckout(sessionId) {
  const s = await api().checkout.sessions.retrieve(sessionId);
  if (s.status !== 'complete' || !s.customer) return null;
  return typeof s.customer === 'string' ? s.customer : s.customer.id;
}

// For email login: the first customer with this email who is paid up.
export async function memberByEmail(email) {
  const customers = await api().customers.list({ email, limit: 10 });
  for (const c of customers.data) {
    const until = await paidUntil(c.id);
    if (until > Date.now() / 1000) return c.id;
  }
  return null;
}

export async function portalUrl(customerId, base) {
  const s = await api().billingPortal.sessions.create({ customer: customerId, return_url: base });
  return s.url;
}

export function memberCookie(customerId, until) {
  // Re-check with Stripe at period end, and never trust a cookie for more than 35 days.
  const exp = Math.floor(Math.min(until + 3600, Date.now() / 1000 + 35 * 86400));
  const value = sign({ cid: customerId, exp, p: 'member' });
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${35 * 86400}`;
}

export const clearCookie = `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

// Resolves the member for a request. Returns { cid, setCookie? } or null.
export async function currentMember(req) {
  const raw = cookies(req)[COOKIE];
  if (!raw) return null;
  const payload = verify(raw, { allowExpired: true });
  if (!payload?.cid || payload.p !== 'member') return null;
  if (payload.exp >= Date.now() / 1000) return { cid: payload.cid };

  // Paid-up-to time has passed: renew if the subscription is still live.
  const until = await paidUntil(payload.cid);
  if (until <= Date.now() / 1000) return null;
  return { cid: payload.cid, setCookie: memberCookie(payload.cid, until) };
}
