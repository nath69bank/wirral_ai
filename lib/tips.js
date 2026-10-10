import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { CardSchema, SettlementSchema } from './schema.js';
import { TIERS, TIER_ORDER } from './brand.js';
import { fractionalToDecimal, inTierBand } from './odds.js';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5-5';
const MAX_CONTINUATIONS = 5;

export function client() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set');
  return new Anthropic();
}

const tierLines = TIER_ORDER.map((k) => {
  const t = TIERS[k];
  return `- ${t.name} (${t.label}): total price ${t.target}. Stake ${t.stake}pt.`;
}).join('\n');

const PICK_SYSTEM = `You are the analyst behind CMD + SHIFT + CASH, a betting tips service. Each day you look for
value bets across football, horse racing, UFC/MMA and boxing, and post up to three, one per tier:
${tierLines}

Value is the only reason to post. A bet is value when your honest estimate of its chance is higher than the
chance implied by the price. If a tier has nothing that clears that bar today, leave it out: posting nothing
is better than posting a bad bet. Never pad a price with legs you don't believe in.

What counts:
- Football: match result or double chance as the base, then the price from player shots, shots on target,
  cards and fouls, corners, goals. Accas across games or bet builders within a game.
- Horse racing: singles, each-way singles and doubles. Use the racecard, recent form, going, course and
  distance record, trainer and jockey form, and the draw. Check for non-runners.
- UFC/MMA and boxing: winner, method of victory, round betting, distance/no distance. Use records, recent
  form, reach and style matchups, short-notice replacements and weigh-in news.
- Mix sports in one acca only when each leg is good on its own.

How to research:
- Search the web for today's fixtures, racecards and fight cards, then team news, line-ups, non-runners and
  weigh-in results. Prefer Opta / The Analyst, the Premier League site, FBref, WhoScored, Sofascore, Racing
  Post, Timeform, At The Races, UFC Stats, Tapology and BoxRec. Bookmaker and tipster previews are fine for prices.
- Confirm every player's current club and every horse's declared run today. Ignore pages from earlier seasons.
- Never invent a number. If you can't back a pick with a figure, drop it.
- Prices are your best estimate from what you find; say so. Bet builders price lower than the legs multiplied.

Finish with a full write-up: for each bet, its tier, every leg with start time, price and reasoning, the
total price, the value case (your probability vs the implied one), and what to check before placing. Then
say what you passed on and why, and list the source URLs.`;

const SETTLE_SYSTEM = `You settle bets for a tipping service. For each bet, search the web for the actual
results and decide: won, lost, void (e.g. non-runner, fight cancelled), placed (each-way bet whose horse
placed but did not win; give the net profit in points using the standard place terms you find), or pending
(event not finished, or you cannot find a reliable result). A multi-leg bet wins only if every leg wins.
Be strict: a player shots-on-target leg needs a source that reports the stat. Cite the score or result.`;

// Runs one research turn with web search, resuming paused turns. Returns the
// final write-up (the text after the last tool call).
async function research(api, system, prompt, maxSearches) {
  const messages = [{ role: 'user', content: prompt }];
  const blocks = [];
  let response;
  for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
    response = await api.beta.messages
      .stream({
        model: MODEL,
        max_tokens: 64000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system,
        output_config: { effort: 'high' },
        tools: [
          { type: 'web_search_20260209', name: 'web_search', max_uses: maxSearches },
          { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: Math.ceil(maxSearches / 2) },
        ],
        messages,
      })
      .finalMessage();

    blocks.push(...response.content);
    if (response.stop_reason !== 'pause_turn') break;
    // The server-side tool loop paused: send the turn so far back and it resumes.
    messages.splice(1, messages.length - 1, { role: 'assistant', content: [...blocks] });
  }

  if (response.stop_reason === 'refusal') throw new Error('research step was refused');
  if (response.stop_reason === 'pause_turn') throw new Error('research did not finish within the continuation limit');

  const lastTool = blocks.findLastIndex((b) => b.type.endsWith('tool_result'));
  const text = blocks
    .slice(lastTool + 1)
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  if (!text) throw new Error('research returned no text');
  return text;
}

async function structure(api, schema, instructions, notes) {
  const response = await api.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: 'low', format: zodOutputFormat(schema) },
    messages: [{ role: 'user', content: `${instructions}\n\n<writeup>\n${notes}\n</writeup>` }],
  });
  if (!response.parsed_output) throw new Error(`structuring failed (stop_reason ${response.stop_reason})`);
  return response.parsed_output;
}

function footballBrief(ctx) {
  if (!ctx?.fixtures?.length) return '';
  return [
    `\nPremier League fixtures today (official feed, Gameweek ${ctx.gameweek}):`,
    ...ctx.fixtures.map((f) => `- ${f.home} v ${f.away}, ${f.kickoff_uk} UK`),
    'Fantasy Premier League season numbers for the most-used players (status a/d/i/s/u = available/doubtful/',
    'injured/suspended/unavailable). A starting point; check current team news on top:',
    JSON.stringify(ctx.players),
  ].join('\n');
}

// Keeps one bet per tier, drops anything outside its tier's price band, and
// stamps ids and stakes. Returns { bets, dropped }.
export function finaliseBets(date, raw) {
  const bets = [];
  const dropped = [];
  for (const bet of raw) {
    const decimal = bet.decimal_odds || fractionalToDecimal(bet.odds);
    if (bets.some((b) => b.tier === bet.tier)) {
      dropped.push(`${bet.tier}: second bet in the same tier`);
    } else if (!decimal || !inTierBand(bet.tier, decimal)) {
      dropped.push(`${bet.tier}: price ${bet.odds} is outside the ${TIERS[bet.tier].target} band`);
    } else {
      bets.push({
        ...bet,
        id: `${date}-${bet.tier}`,
        decimal_odds: decimal,
        stake_pts: TIERS[bet.tier].stake,
        result: 'pending',
        profit_pts: null,
        settled_note: null,
      });
    }
  }
  bets.sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));
  return { bets, dropped };
}

export async function pickBets(date, footballCtx, api = client()) {
  const prompt = `Today is ${date} (UK). Find today's value bets.${footballBrief(footballCtx)}`;
  const notes = await research(api, PICK_SYSTEM, prompt, 40);
  const card = await structure(
    api,
    CardSchema,
    'Convert this betting write-up into the JSON schema. Copy bets, legs, prices, reasoning and URLs ' +
      'faithfully; add nothing that is not in the write-up. decimal_odds is the total price as a decimal.',
    notes,
  );
  const { bets, dropped } = finaliseBets(date, card.bets);
  return {
    date,
    generated_at: new Date().toISOString(),
    summary: card.summary,
    passed_on: card.passed_on,
    sources: card.sources,
    bets,
    dropped,
  };
}

// Settles pending bets. `bets` are full bet objects; returns [{id, result, profit_pts, note}].
export async function settleBets(bets, api = client()) {
  const listing = bets.map((b) => ({
    id: b.id,
    bet_type: b.bet_type,
    stake_pts: b.stake_pts,
    odds: b.odds,
    legs: b.legs.map((l) => ({ event: l.event, start_uk: l.start_uk, selection: l.selection, odds: l.odds })),
  }));
  const notes = await research(api, SETTLE_SYSTEM, `Settle these bets:\n${JSON.stringify(listing, null, 2)}`, 20);
  const { results } = await structure(
    api,
    SettlementSchema,
    'Convert this settlement write-up into the JSON schema, one entry per bet id.',
    notes,
  );
  const ids = new Set(bets.map((b) => b.id));
  return results.filter((r) => ids.has(r.id));
}
