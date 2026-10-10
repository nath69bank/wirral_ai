import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fractionalToDecimal, inTierBand, profitPts, record } from '../lib/odds.js';
import { finaliseBets } from '../lib/tips.js';
import { formatBet, formatTeaser, formatResults } from '../lib/telegram.js';
import { sampleCard } from './fixtures/card.js';

test('fractional odds convert to decimal', () => {
  assert.equal(fractionalToDecimal('4/1'), 5);
  assert.equal(fractionalToDecimal('11/4'), 3.75);
  assert.equal(fractionalToDecimal('Evens'), 2);
  assert.equal(fractionalToDecimal('nonsense'), null);
});

test('tier bands: CMD ~4/1, SHIFT 20/1+, CASH 100/1+', () => {
  assert.ok(inTierBand('cmd', 5));
  assert.ok(!inTierBand('cmd', 12));
  assert.ok(inTierBand('shift', 21));
  assert.ok(!inTierBand('shift', 15));
  assert.ok(inTierBand('cash', 101));
  assert.ok(!inTierBand('cash', 80));
});

test('profit and record in points', () => {
  const bets = [
    { stake_pts: 1, decimal_odds: 5, result: 'won' },
    { stake_pts: 0.5, decimal_odds: 25, result: 'lost' },
    { stake_pts: 0.25, decimal_odds: 120, result: 'pending' },
    { stake_pts: 0.25, decimal_odds: 120, result: 'placed', profit_pts: 1.2 },
  ];
  assert.equal(profitPts(bets[0]), 4);
  assert.equal(profitPts(bets[1]), -0.5);
  assert.deepEqual(record(bets), { bets: 3, won: 1, profit_pts: 4.7, roi: 268.6 });
});

test('finaliseBets keeps one bet per tier inside its band and stamps stakes', () => {
  const raw = [
    { tier: 'cash', odds: '40/1', decimal_odds: 41, legs: [] },
    { tier: 'cmd', odds: '4/1', decimal_odds: 5, legs: [] },
    { tier: 'cmd', odds: '5/1', decimal_odds: 6, legs: [] },
    { tier: 'shift', odds: '25/1', decimal_odds: 0, legs: [] },
  ];
  const { bets, dropped } = finaliseBets('2026-10-11', raw);
  assert.deepEqual(bets.map((b) => [b.id, b.stake_pts, b.result]), [
    ['2026-10-11-cmd', 1, 'pending'],
    ['2026-10-11-shift', 0.5, 'pending'],
  ]);
  assert.equal(bets[1].decimal_odds, 26); // fell back to parsing the fractional price
  assert.equal(dropped.length, 2);
});

test('Telegram posts escape HTML; teasers hide selections', () => {
  const [, cash] = sampleCard('2026-10-11').bets;
  const full = formatBet(cash, 'https://example.com/?date=2026-10-11');
  assert.match(full, /Sample &lt;CASH&gt; &amp; co/);
  assert.match(full, /SECRET D to win/);
  const teaser = formatTeaser(cash, 'https://example.com');
  assert.doesNotMatch(teaser, /SECRET|Sample &lt;CASH/);
  assert.match(teaser, /110\/1/);
  const results = formatResults('2026-10-11', [{ ...cash, result: 'won', settled_note: 'Both won' }]);
  assert.match(results, /\+27\.5pts/);
});
