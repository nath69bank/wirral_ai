import { json, redirect, query, readBody, siteUrl } from '../lib/http.js';
import { sign, verify } from '../lib/session.js';
import {
  clearCookie,
  currentMember,
  customerFromCheckout,
  memberByEmail,
  memberCookie,
  paidUntil,
  portalUrl,
} from '../lib/members.js';
import { sendLoginLink } from '../lib/email.js';

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

async function signIn(res, base, cid, to) {
  const until = await paidUntil(cid);
  if (until <= Date.now() / 1000) return redirect(res, `${base}/?signin=lapsed#join`);
  return redirect(res, `${base}${to}`, { 'Set-Cookie': memberCookie(cid, until) });
}

export default async function handler(req, res) {
  const { action, session_id, token } = query(req);
  const base = siteUrl(req);
  try {
    // Back from Stripe Checkout.
    if (req.method === 'GET' && action === 'return' && session_id) {
      const cid = await customerFromCheckout(session_id);
      if (!cid) return redirect(res, `${base}/?signin=failed#join`);
      return signIn(res, base, cid, '/?welcome=1');
    }

    // Link from the login email.
    if (req.method === 'GET' && action === 'verify') {
      const payload = verify(token);
      if (!payload || payload.p !== 'login') return redirect(res, `${base}/?signin=expired#login`);
      return signIn(res, base, payload.cid, '/');
    }

    if (req.method === 'POST' && action === 'login') {
      const { email } = await readBody(req);
      if (typeof email !== 'string' || !EMAIL.test(email.trim())) return json(res, 400, { error: 'bad_email' });
      const cid = await memberByEmail(email.trim());
      if (cid) {
        const t = sign({ cid, p: 'login', exp: Math.floor(Date.now() / 1000) + 1800 });
        await sendLoginLink(email.trim(), `${base}/api/auth?action=verify&token=${encodeURIComponent(t)}`);
      }
      // Same answer either way, so the form can't be used to look up who's a member.
      return json(res, 200, { ok: true });
    }

    if (req.method === 'POST' && action === 'logout') {
      return json(res, 200, { ok: true }, { 'Set-Cookie': clearCookie });
    }

    if (req.method === 'POST' && action === 'portal') {
      const member = await currentMember(req);
      if (!member) return json(res, 401, { error: 'not_member' });
      return json(res, 200, { url: await portalUrl(member.cid, base) });
    }

    return json(res, 404, { error: 'unknown_action' });
  } catch (e) {
    console.error('auth', action, e);
    return json(res, 503, { error: 'unavailable' });
  }
}
