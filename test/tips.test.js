import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickBets, settleBets } from '../lib/tips.js';

function fakeApi(turns, parsed) {
  const calls = [];
  return {
    calls,
    beta: { messages: { stream: (p) => (calls.push(structuredClone(p)), { finalMessage: async () => turns.shift() }) } },
    messages: { parse: async (p) => (calls.push(p.messages[0].content), { parsed_output: parsed, stop_reason: 'end_turn' }) },
  };
}

const bet = (tier, odds, decimal) => ({
  tier, title: 't', sport: 'football', bet_type: 'acca', odds, decimal_odds: decimal, value_case: 'v', check: 'c',
  legs: [{ sport: 'football', event: 'A v B', start_uk: '15:00', selection: 's', odds: '1/1', reasoning: 'r' }],
});

test('pickBets resumes paused research, structures only the final write-up, and enforces tiers', async () => {
  const api = fakeApi(
    [
      { stop_reason: 'pause_turn', content: [{ type: 'text', text: 'Looking at racecards…' }, { type: 'server_tool_use', id: '1', name: 'web_search', input: {} }, { type: 'web_search_tool_result', tool_use_id: '1', content: [] }] },
      { stop_reason: 'end_turn', content: [{ type: 'web_search_tool_result', tool_use_id: '2', content: [] }, { type: 'text', text: 'FINAL WRITE-UP' }] },
    ],
    { summary: 's', passed_on: 'p', sources: [], bets: [bet('cmd', '4/1', 5), bet('cash', '30/1', 31)] },
  );
  const card = await pickBets('2026-10-11', { gameweek: 7, fixtures: [{ home: 'A', away: 'B', kickoff_uk: '15:00' }], players: {} }, api);
  assert.equal(api.calls[1].messages[1].role, 'assistant');
  assert.equal(api.calls[1].messages[1].content.length, 3);
  assert.match(api.calls[0].messages[0].content, /A v B, 15:00 UK/);
  assert.equal(api.calls[0].tools[0].type, 'web_search_20260209');
  assert.match(api.calls[2], /FINAL WRITE-UP/);
  assert.doesNotMatch(api.calls[2], /Looking at racecards/);
  assert.deepEqual(card.bets.map((b) => b.id), ['2026-10-11-cmd']);
  assert.equal(card.dropped.length, 1);
});

test('research gives up after repeated pauses', async () => {
  const paused = () => ({ stop_reason: 'pause_turn', content: [{ type: 'text', text: 'x' }] });
  await assert.rejects(pickBets('2026-10-11', null, fakeApi(Array.from({ length: 10 }, paused), null)), /continuation limit/);
});

test('settleBets ignores results for ids it did not ask about', async () => {
  const api = fakeApi([{ stop_reason: 'end_turn', content: [{ type: 'text', text: 'settled' }] }], {
    results: [
      { id: 'a', result: 'won', profit_pts: null, note: '2-0' },
      { id: 'zzz', result: 'won', profit_pts: null, note: '?' },
    ],
  });
  const out = await settleBets([{ id: 'a', bet_type: 'single', stake_pts: 1, odds: '4/1', legs: [] }], api);
  assert.deepEqual(out.map((r) => r.id), ['a']);
});
