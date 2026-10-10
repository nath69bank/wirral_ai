import { TIERS, SPORTS, BET_TYPES } from './brand.js';
import { profitPts } from './odds.js';

const API = 'https://api.telegram.org';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function call(method, params) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set');
  const res = await fetch(`${API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!body.ok) throw new Error(`Telegram ${method} failed: ${body.description || res.status}`);
  return body.result;
}

export const sendMessage = (chatId, html) =>
  call('sendMessage', { chat_id: chatId, text: html, parse_mode: 'HTML', link_preview_options: { is_disabled: true } });

// A single-use link into the premium group, valid for 24 hours.
export async function createInviteLink(name) {
  const chat = process.env.TELEGRAM_PREMIUM_CHAT_ID;
  if (!chat) throw new Error('TELEGRAM_PREMIUM_CHAT_ID is not set');
  const link = await call('createChatInviteLink', {
    chat_id: chat,
    name: String(name).slice(0, 32),
    member_limit: 1,
    expire_date: Math.floor(Date.now() / 1000) + 24 * 3600,
  });
  return link.invite_link;
}

const head = (bet) => {
  const t = TIERS[bet.tier];
  return `<b>${t.key} ${t.name}</b> · ${esc(bet.odds)} · ${SPORTS[bet.sport]} ${BET_TYPES[bet.bet_type].toLowerCase()}`;
};

// Full post for the premium group.
export function formatBet(bet, siteUrl) {
  const lines = [head(bet), `<b>${esc(bet.title)}</b>`, ''];
  bet.legs.forEach((l, i) => {
    lines.push(`${i + 1}. ${esc(l.event)} (${esc(l.start_uk)})`, `   <b>${esc(l.selection)}</b> @ ${esc(l.odds)}`);
  });
  lines.push(
    '',
    `💷 Stake ${bet.stake_pts}pt @ <b>${esc(bet.odds)}</b>`,
    `📈 <i>${esc(bet.value_case)}</i>`,
    `✅ Check: ${esc(bet.check)}`,
  );
  if (siteUrl) lines.push('', `Full reasoning: ${esc(siteUrl)}`);
  lines.push('', '18+ · Prices may move · BeGambleAware.org');
  return lines.join('\n');
}

// Teaser for the free channel: shows the bet exists, hides the selections.
export function formatTeaser(bet, siteUrl) {
  const n = bet.legs.length;
  return [
    head(bet),
    `${n} leg${n === 1 ? '' : 's'} · first start ${esc(bet.legs[0]?.start_uk ?? '')} UK`,
    '',
    `🔒 Selections are for members.${siteUrl ? ` Join at ${esc(siteUrl)}` : ''}`,
  ].join('\n');
}

export function formatResults(date, bets) {
  const icon = { won: '✅', lost: '❌', void: '↩️', placed: '🟡' };
  const lines = [`<b>Results · ${esc(date)}</b>`];
  let total = 0;
  for (const b of bets) {
    const p = profitPts(b);
    total += p;
    lines.push(`${icon[b.result] ?? '⏳'} ${TIERS[b.tier].name} ${esc(b.odds)}: ${p >= 0 ? '+' : ''}${p}pts. ${esc(b.settled_note ?? '')}`);
  }
  lines.push('', `Day: ${total >= 0 ? '+' : ''}${Math.round(total * 100) / 100}pts`);
  return lines.join('\n');
}
