import { json, siteUrl } from '../lib/http.js';
import { createCheckout } from '../lib/members.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  try {
    return json(res, 200, { url: await createCheckout(siteUrl(req)) });
  } catch (e) {
    console.error('checkout', e);
    return json(res, 503, { error: 'checkout_unavailable' });
  }
}
