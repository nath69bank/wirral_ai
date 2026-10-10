import { z } from 'zod';

const Leg = z.object({
  sport: z.enum(['football', 'horse_racing', 'mma', 'boxing']),
  event: z.string().describe('e.g. "Arsenal v Leeds", "3:15 Ascot", "UFC 320: Smith v Jones"'),
  start_uk: z.string().describe('Start time in UK time, 24h, e.g. "15:00"'),
  selection: z.string().describe('e.g. "Saka 1+ shot on target", "Desert Crown (each way)", "Jones by KO/TKO"'),
  odds: z.string().describe('Fractional, e.g. "10/11"'),
  reasoning: z.string().describe('The numbers behind the pick: form, stats, matchup.'),
});

const Bet = z.object({
  tier: z.enum(['cmd', 'shift', 'cash']),
  title: z.string().describe('Short, e.g. "Saturday early-kick-off builder"'),
  sport: z.enum(['football', 'horse_racing', 'mma', 'boxing', 'mixed']),
  bet_type: z.enum(['acca', 'bet_builder', 'single', 'each_way', 'multiple']),
  legs: z.array(Leg),
  odds: z.string().describe('Total fractional price, e.g. "22/1"'),
  decimal_odds: z.number().describe('Total decimal price, e.g. 23.0'),
  value_case: z.string().describe('Why the price is bigger than the real chance: your estimated probability vs the implied one.'),
  check: z.string().describe('What to confirm before placing: team sheets, non-runners, weigh-ins.'),
});

export const CardSchema = z.object({
  summary: z.string().describe('One or two sentences on today\'s card.'),
  bets: z.array(Bet).describe('At most one bet per tier. Leave a tier out if there is no value today.'),
  passed_on: z.string().describe('What was considered and rejected, and why. One short paragraph.'),
  sources: z.array(z.object({ title: z.string(), url: z.string() })),
});

export const SettlementSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      result: z.enum(['won', 'lost', 'void', 'placed', 'pending']),
      profit_pts: z.number().nullable().describe('Only for "placed" each-way results: the net profit or loss in points. Null otherwise.'),
      note: z.string().describe('One line: the score or result that decided it.'),
    }),
  ),
});
