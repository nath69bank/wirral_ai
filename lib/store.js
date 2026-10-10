// Cards live in a private Vercel Blob store so members-only bets never sit in
// the public repo. Without BLOB_READ_WRITE_TOKEN (local dev, tests) they go to
// ./.data on disk instead.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const LOCAL_DIR = () => process.env.CASH_DATA_DIR || path.resolve('.data');
const useBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

async function readJSON(key) {
  if (!useBlob()) {
    try {
      return JSON.parse(await readFile(path.join(LOCAL_DIR(), key), 'utf8'));
    } catch (e) {
      if (e.code === 'ENOENT') return null;
      throw e;
    }
  }
  const { get } = await import('@vercel/blob');
  const res = await get(key, { access: 'private', useCache: false });
  if (!res) return null;
  return JSON.parse(await new Response(res.stream).text());
}

async function writeJSON(key, value) {
  const body = JSON.stringify(value, null, 2);
  if (!useBlob()) {
    const file = path.join(LOCAL_DIR(), key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
    return;
  }
  const { put } = await import('@vercel/blob');
  await put(key, body, {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  });
}

export const getCard = (date) => readJSON(`cards/${date}.json`);

export async function getIndex() {
  return (await readJSON('cards/index.json')) || { cards: [] };
}

// Saves a card and keeps cards/index.json (newest first) in step. The index
// carries just enough for the public track record.
export async function saveCard(card) {
  await writeJSON(`cards/${card.date}.json`, card);
  const index = await getIndex();
  const entry = {
    date: card.date,
    bets: card.bets.map((b) => ({
      id: b.id,
      tier: b.tier,
      sport: b.sport,
      bet_type: b.bet_type,
      odds: b.odds,
      decimal_odds: b.decimal_odds,
      stake_pts: b.stake_pts,
      result: b.result,
      profit_pts: b.profit_pts ?? null,
    })),
  };
  index.cards = [entry, ...index.cards.filter((c) => c.date !== card.date)].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  index.updated_at = new Date().toISOString();
  await writeJSON('cards/index.json', index);
}
