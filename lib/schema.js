import { z } from 'zod';

// One published acca. The site renders exactly this shape, and the hand-written
// seed in data/accas/ follows it too.

const Prop = z.object({
  market: z.enum(['shots_on_target', 'shots', 'cards', 'fouls', 'corners', 'goals', 'assists', 'btts', 'other']),
  selection: z.string().describe('e.g. "Bukayo Saka 1+ shot on target", "Over 8.5 match corners"'),
  why: z.string().describe('One or two sentences, citing the actual numbers that justify it.'),
  est_odds: z.string().describe('Fractional, e.g. "10/11". "n/a" if no price was found.'),
});

const Leg = z.object({
  home: z.string(),
  away: z.string(),
  kickoff_uk: z.string().describe('24h UK time, e.g. "15:00"'),
  result: z.object({
    type: z.enum(['match_win', 'double_chance']),
    selection: z.string().describe('e.g. "Arsenal to win", "Brighton or Draw"'),
    why: z.string(),
    est_odds: z.string(),
  }),
  props: z.array(Prop).describe('Exactly two selections: shots on target, cards, corners, etc.'),
  est_leg_odds: z.string().describe('Rough bet-builder price for this leg, fractional.'),
  check: z.string().describe('What to confirm before betting, e.g. which players must be on the team sheet.'),
});

export const AccaSchema = z.object({
  headline: z.string().describe('Short title, e.g. "Saturday 3-fold: Arsenal, Brighton, Man Utd"'),
  summary: z.string().describe('Two sentences: the angle of the acca and the main risk.'),
  lineup_status: z.enum(['confirmed', 'predicted', 'mixed']),
  legs: z.array(Leg),
  est_total_odds: z.string().describe('Range, e.g. "40/1 to 60/1"'),
  safer: z.object({ change: z.string(), est_odds: z.string() }),
  bigger: z.object({ change: z.string(), est_odds: z.string() }),
  left_out: z.array(z.object({ fixture: z.string(), reason: z.string() })),
  sources: z.array(z.object({ title: z.string(), url: z.string() })),
});
