#!/usr/bin/env node
// The daily run, triggered by GitHub Actions:
//   1. settle earlier bets that are still pending, and post the results
//   2. find today's value bets, save them, and post them to Telegram
//
//   node scripts/daily.js [--date YYYY-MM-DD] [--force] [--skip-settle] [--no-post]
//
// The repo is public, so this never logs selections: only tiers and prices.

import { parseArgs } from 'node:util';
import { getDayContext } from '../lib/fpl.js';
import { pickBets, settleBets } from '../lib/tips.js';
import { getCard, getIndex, saveCard } from '../lib/store.js';
import { formatBet, formatResults, formatTeaser, sendMessage } from '../lib/telegram.js';
import { TIERS } from '../lib/brand.js';
import { ukDate } from '../lib/dates.js';

const { values: opts } = parseArgs({
  options: {
    date: { type: 'string', default: ukDate() },
    force: { type: 'boolean', default: false },
    'skip-settle': { type: 'boolean', default: false },
    'no-post': { type: 'boolean', default: false },
  },
});
const date = opts.date;
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`--date must be YYYY-MM-DD, got "${date}"`);

const SITE = process.env.SITE_URL?.replace(/\/$/, '');
const PREMIUM = process.env.TELEGRAM_PREMIUM_CHAT_ID;
const FREE = process.env.TELEGRAM_FREE_CHAT_ID;

async function post(chat, html) {
  if (opts['no-post'] || !chat || !process.env.TELEGRAM_BOT_TOKEN) return;
  try {
    await sendMessage(chat, html);
  } catch (e) {
    console.error(`Telegram post failed: ${e.message}`);
  }
}

async function settle() {
  const index = await getIndex();
  const due = index.cards.filter((c) => c.date < date && c.bets.some((b) => b.result === 'pending'));
  for (const { date: day } of due) {
    const card = await getCard(day);
    const pending = card.bets.filter((b) => b.result === 'pending');
    const results = await settleBets(pending);
    let changed = false;
    for (const r of results) {
      if (r.result === 'pending') continue;
      const bet = card.bets.find((b) => b.id === r.id);
      Object.assign(bet, { result: r.result, profit_pts: r.result === 'placed' ? r.profit_pts : null, settled_note: r.note });
      changed = true;
    }
    if (!changed) {
      console.log(`${day}: still pending`);
      continue;
    }
    await saveCard(card);
    const done = card.bets.filter((b) => b.result !== 'pending');
    console.log(`${day}: settled ${done.map((b) => `${TIERS[b.tier].name} ${b.result}`).join(', ')}`);
    if (card.bets.every((b) => b.result !== 'pending')) {
      const html = formatResults(day, card.bets);
      await post(PREMIUM, html);
      await post(FREE, html);
    }
  }
}

async function pick() {
  if (!opts.force && (await getCard(date))) {
    console.log(`${date}: card already posted; pass --force to rebuild.`);
    return;
  }

  let football = null;
  try {
    football = await getDayContext(date);
    console.log(`${date}: ${football.fixtures.length} Premier League fixtures`);
  } catch (e) {
    console.warn(`Fixture feed unavailable (${e.message}); research will find fixtures itself.`);
  }

  const card = await pickBets(date, football);
  for (const reason of card.dropped) console.log(`Dropped: ${reason}`);
  delete card.dropped;
  await saveCard(card);

  if (!card.bets.length) {
    console.log(`${date}: no value bets today, nothing posted.`);
    return;
  }
  console.log(`${date}: posted ${card.bets.map((b) => `${TIERS[b.tier].name} ${b.odds}`).join(', ')}`);
  const link = SITE ? `${SITE}/?date=${date}` : null;
  for (const bet of card.bets) {
    await post(PREMIUM, formatBet(bet, link));
    await post(FREE, formatTeaser(bet, SITE));
  }
}

if (!opts['skip-settle']) {
  try {
    await settle();
  } catch (e) {
    // A settlement problem shouldn't stop today's bets going out.
    console.error(`Settlement failed: ${e.message}`);
    process.exitCode = 1;
  }
}
await pick();
