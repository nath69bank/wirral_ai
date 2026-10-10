import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

process.env.ACCA_DATA_DIR = await mkdtemp(path.join(tmpdir(), 'acca-'));
const { generateAcca } = await import('../lib/acca.js');
const { saveAcca, hasAcca } = await import('../lib/store.js');

const leg = (home, away) => ({
  home, away, kickoff_uk: '15:00',
  result: { type: 'double_chance', selection: `${away} or Draw`, why: 'w', est_odds: '4/9' },
  props: [
    { market: 'cards', selection: 'X to be carded', why: 'w', est_odds: '3/1' },
    { market: 'corners', selection: 'Over 8.5 corners', why: 'w', est_odds: '4/9' },
  ],
  est_leg_odds: '4/1', check: 'c',
});
const parsed = {
  headline: 'H', summary: 'S', lineup_status: 'predicted',
  legs: [leg('A', 'B')], est_total_odds: '4/1',
  safer: { change: 's', est_odds: '2/1' }, bigger: { change: 'b', est_odds: '9/1' },
  left_out: [], sources: [{ title: 't', url: 'https://example.com' }],
};

function fakeApi(turns) {
  const calls = [];
  return {
    calls,
    beta: { messages: { stream: (params) => {
      calls.push(structuredClone(params.messages));
      return { finalMessage: async () => turns.shift() };
    } } },
    messages: { parse: async (params) => {
      calls.push(params.messages[0].content);
      return { parsed_output: parsed, stop_reason: 'end_turn' };
    } },
  };
}

test('resumes paused turns and hands only the final write-up to the structuring step', async () => {
  const api = fakeApi([
    { stop_reason: 'pause_turn', content: [
      { type: 'text', text: 'Searching team news…' },
      { type: 'server_tool_use', id: 's1', name: 'web_search', input: {} },
      { type: 'web_search_tool_result', tool_use_id: 's1', content: [] },
    ] },
    { stop_reason: 'end_turn', content: [
      { type: 'server_tool_use', id: 's2', name: 'web_search', input: {} },
      { type: 'web_search_tool_result', tool_use_id: 's2', content: [] },
      { type: 'text', text: 'FINAL ACCA WRITE-UP' },
    ] },
  ]);
  const acca = await generateAcca('2026-10-10', { gameweek: 6, fixtures: [{ home: 'A', away: 'B', kickoff_uk: '15:00' }], players: {} }, api);

  // second request resends the user brief plus everything produced so far
  assert.equal(api.calls[1].length, 2);
  assert.equal(api.calls[1][1].role, 'assistant');
  assert.equal(api.calls[1][1].content.length, 3);
  assert.match(api.calls[0][0].content, /A v B, 15:00 UK/);

  assert.match(api.calls[2], /FINAL ACCA WRITE-UP/);
  assert.doesNotMatch(api.calls[2], /Searching team news/);
  assert.equal(acca.date, '2026-10-10');
  assert.equal(acca.gameweek, 6);
  assert.equal(acca.legs.length, 1);
});

test('gives up after repeated pauses instead of looping forever', async () => {
  const paused = () => ({ stop_reason: 'pause_turn', content: [{ type: 'text', text: 'x' }] });
  const api = fakeApi(Array.from({ length: 10 }, paused));
  await assert.rejects(generateAcca('2026-10-10', null, api), /continuation limit/);
});

test('saveAcca writes the file and keeps the index newest-first without duplicates', async () => {
  await saveAcca({ date: '2026-10-03', gameweek: 5, headline: 'old', est_total_odds: '1/1' });
  await saveAcca({ date: '2026-10-10', gameweek: 6, headline: 'first', est_total_odds: '1/1' });
  await saveAcca({ date: '2026-10-10', gameweek: 6, headline: 'rebuilt', est_total_odds: '2/1' });
  const index = JSON.parse(await readFile(path.join(process.env.ACCA_DATA_DIR, 'index.json'), 'utf8'));
  assert.deepEqual(index.accas.map((a) => [a.date, a.headline]), [['2026-10-10', 'rebuilt'], ['2026-10-03', 'old']]);
  assert.equal(await hasAcca('2026-10-10'), true);
  assert.equal(await hasAcca('2026-10-11'), false);
});
