import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = process.env.ACCA_DATA_DIR || path.join(ROOT, 'data');
const ACCAS = () => path.join(DATA_DIR, 'accas');
const INDEX = () => path.join(DATA_DIR, 'index.json');

export async function hasAcca(date) {
  try {
    await access(path.join(ACCAS(), `${date}.json`));
    return true;
  } catch {
    return false;
  }
}

async function readIndex() {
  try {
    return JSON.parse(await readFile(INDEX(), 'utf8'));
  } catch {
    return { accas: [] };
  }
}

// Writes data/accas/<date>.json and keeps data/index.json (newest first) in step.
export async function saveAcca(acca) {
  await mkdir(ACCAS(), { recursive: true });
  await writeFile(path.join(ACCAS(), `${acca.date}.json`), JSON.stringify(acca, null, 2) + '\n');

  const index = await readIndex();
  const entry = {
    date: acca.date,
    gameweek: acca.gameweek,
    headline: acca.headline,
    est_total_odds: acca.est_total_odds,
  };
  index.accas = [entry, ...index.accas.filter((a) => a.date !== acca.date)].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  index.updated_at = new Date().toISOString();
  await writeFile(INDEX(), JSON.stringify(index, null, 2) + '\n');
}
