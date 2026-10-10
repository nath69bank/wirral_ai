#!/usr/bin/env node
// Builds today's acca and saves it to data/. Run daily by the GitHub Action;
// it exits quietly on days with no Premier League fixtures.
//
//   node scripts/generate.js                 # today (UK)
//   node scripts/generate.js --date 2026-10-10
//   node scripts/generate.js --force         # rebuild even if today's acca exists

import { parseArgs } from 'node:util';
import { getDayContext, ukDate } from '../lib/fpl.js';
import { generateAcca } from '../lib/acca.js';
import { hasAcca, saveAcca } from '../lib/store.js';

const { values } = parseArgs({
  options: {
    date: { type: 'string', default: ukDate(new Date()) },
    force: { type: 'boolean', default: false },
  },
});
const date = values.date;

if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error(`--date must be YYYY-MM-DD, got "${date}"`);
  process.exit(1);
}

if (!values.force && (await hasAcca(date))) {
  console.log(`Acca for ${date} already exists; pass --force to rebuild.`);
  process.exit(0);
}

let ctx = null;
try {
  ctx = await getDayContext(date);
  if (!ctx.fixtures.length) {
    console.log(`No Premier League fixtures on ${date}.`);
    process.exit(0);
  }
  console.log(`Gameweek ${ctx.gameweek}: ${ctx.fixtures.map((f) => `${f.home} v ${f.away}`).join(', ')}`);
} catch (e) {
  console.warn(`Fixture feed unavailable (${e.message}); the model will find fixtures itself.`);
}

const acca = await generateAcca(date, ctx);
if (!acca.legs.length) {
  console.log(`No acca built for ${date}: ${acca.summary}`);
  process.exit(0);
}
await saveAcca(acca);
console.log(`Saved ${date}: ${acca.headline} (${acca.est_total_odds})`);
