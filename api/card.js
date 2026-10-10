import { json, query } from '../lib/http.js';
import { getCard, getIndex } from '../lib/store.js';
import { currentMember } from '../lib/members.js';
import { record } from '../lib/odds.js';
import { TIER_ORDER } from '../lib/brand.js';
import { ukDate } from '../lib/dates.js';

// Non-members see that today's bets exist, with tier, sport and price, but not
// the selections. Earlier days are public in full: that's the track record.
function teaser(bet) {
  return {
    id: bet.id,
    tier: bet.tier,
    sport: bet.sport,
    bet_type: bet.bet_type,
    odds: bet.odds,
    stake_pts: bet.stake_pts,
    legs_count: bet.legs.length,
    first_start: bet.legs.map((l) => l.start_uk).sort()[0] ?? null,
    result: bet.result,
    locked: true,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });
  try {
    const [index, member] = await Promise.all([getIndex(), currentMember(req).catch(() => null)]);
    const headers = member?.setCookie ? { 'Set-Cookie': member.setCookie } : {};
    const dates = index.cards.map((c) => c.date);
    const wanted = query(req).date;
    const date = dates.includes(wanted) ? wanted : dates[0];

    const all = index.cards.flatMap((c) => c.bets);
    const track = {
      overall: record(all),
      tiers: Object.fromEntries(TIER_ORDER.map((t) => [t, record(all.filter((b) => b.tier === t))])),
    };
    const base = { dates, member: Boolean(member), record: track, price_label: process.env.PRICE_LABEL || null };
    if (!date) return json(res, 200, { ...base, date: null, card: null }, headers);

    const card = await getCard(date);
    if (!card) return json(res, 200, { ...base, date: null, card: null }, headers);
    const locked = !member && date >= ukDate();
    const body = locked
      ? { date, generated_at: card.generated_at, bets: card.bets.map(teaser) }
      : {
          date,
          generated_at: card.generated_at,
          summary: card.summary,
          passed_on: card.passed_on,
          sources: card.sources,
          bets: card.bets,
        };
    return json(res, 200, { ...base, date, locked, card: body }, headers);
  } catch (e) {
    console.error('card', e);
    return json(res, 500, { error: 'unavailable' });
  }
}
