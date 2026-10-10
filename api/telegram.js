import { json } from '../lib/http.js';
import { currentMember } from '../lib/members.js';
import { createInviteLink } from '../lib/telegram.js';

// Members get a single-use, 24-hour link into the premium Telegram group.
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  try {
    const member = await currentMember(req);
    if (!member) return json(res, 401, { error: 'not_member' });
    return json(res, 200, { url: await createInviteLink(`member ${member.cid.slice(-8)}`) });
  } catch (e) {
    console.error('telegram', e);
    return json(res, 503, { error: 'telegram_unavailable' });
  }
}
