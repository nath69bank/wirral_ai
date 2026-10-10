import { TIERS } from './brand.js';

// "11/4" -> 3.75, "evens" -> 2
export function fractionalToDecimal(frac) {
  const s = String(frac).trim().toLowerCase();
  if (s === 'evens' || s === 'evs') return 2;
  const m = s.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  return 1 + Number(m[1]) / Number(m[2]);
}

export function inTierBand(tier, decimal) {
  const t = TIERS[tier];
  return Boolean(t) && decimal >= t.min && decimal <= t.max;
}

// Profit in points for a settled bet. "placed" (each-way) carries its own figure.
export function profitPts(bet) {
  switch (bet.result) {
    case 'won':
      return round(bet.stake_pts * (bet.decimal_odds - 1));
    case 'lost':
      return -bet.stake_pts;
    case 'placed':
      return round(bet.profit_pts ?? 0);
    default:
      return 0;
  }
}

const round = (n) => Math.round(n * 100) / 100;

export function record(bets) {
  const settled = bets.filter((b) => ['won', 'lost', 'placed'].includes(b.result));
  const staked = settled.reduce((s, b) => s + b.stake_pts, 0);
  const profit = round(settled.reduce((s, b) => s + profitPts(b), 0));
  return {
    bets: settled.length,
    won: settled.filter((b) => b.result === 'won').length,
    profit_pts: profit,
    roi: staked ? Math.round((profit / staked) * 1000) / 10 : 0,
  };
}
