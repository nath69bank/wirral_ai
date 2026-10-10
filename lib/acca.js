import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { AccaSchema } from './schema.js';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5-5';
const LEGS = Number(process.env.ACCA_LEGS || 3);
const MAX_CONTINUATIONS = 5;

const SYSTEM = `You are a professional football betting analyst who builds Premier League accumulators.

Every acca you build has the same shape:
- ${LEGS} legs, one per fixture, chosen from the day's Premier League games.
- Each leg has one result selection (a match win or a double chance) plus two more selections from:
  player shots on target, player shots, player cards, player fouls, match or team corners, goals, BTTS.
- The aim is the biggest price that is still realistically possible: lean on the safe result
  selection (a double chance where a win is too risky) and get the price from the player picks.

How to research:
- Use web search for today's team news, injuries, suspensions and confirmed starting XIs.
  If official team sheets are out, use only players who are starting.
  If not, use only players every predicted XI agrees on, and say so in "check".
- Back each player pick with this season's numbers: shots on target per game, the run of games
  with a shot on target, bookings, fouls per game. Prefer Opta / The Analyst, the Premier League
  site, FBref, WhoScored and Sofascore. Bookmaker and tipster previews are fine for prices.
- For card picks, favour players who foul often in a matchup that sets them against a quick
  or tricky opponent. For corners, use both teams' recent corner counts.
- Ignore stale pages from previous seasons. Players move clubs; confirm each player's current
  club before using him.
- Never invent a number. If you can't find a figure, leave the pick out.
- Give fractional odds as estimates and label them so. The combined price will be lower in a
  bet builder because selections in the same game are linked.
- Pick the fixtures where you have the clearest edge; list the others with a one-line reason.

Finish with a full write-up of the acca: every leg, every selection with its reasoning and price,
a rough total, one safer variant, one bigger variant, the games left out, and the source URLs.`;

function client() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set');
  return new Anthropic();
}

function brief(date, ctx) {
  const lines = [`Date: ${date} (UK). Build today's Premier League acca.`];
  if (ctx?.fixtures?.length) {
    lines.push(`\nToday's fixtures (official, Gameweek ${ctx.gameweek}):`);
    for (const f of ctx.fixtures) lines.push(`- ${f.home} v ${f.away}, ${f.kickoff_uk} UK`);
    lines.push(
      '\nSeason numbers from the official Fantasy Premier League feed for the most-used players',
      '(status: a available, d doubtful, i injured, s suspended, u unavailable). Use them as a',
      'starting point and check current team news on top:',
      JSON.stringify(ctx.players),
    );
  } else {
    lines.push('\nThe fixture feed was unavailable: find today\'s Premier League fixtures with web search first.');
  }
  return lines.join('\n');
}

// Step 1: open-ended research with web search. Returns the model's write-up as text.
async function research(api, date, ctx) {
  const messages = [{ role: 'user', content: brief(date, ctx) }];
  const blocks = []; // everything the model has produced across continuations
  let response;
  for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
    response = await api.beta.messages
      .stream({
        model: MODEL,
        max_tokens: 64000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: SYSTEM,
        output_config: { effort: 'high' },
        tools: [
          { type: 'web_search_20260209', name: 'web_search', max_uses: 25 },
          { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 15 },
        ],
        messages,
      })
      .finalMessage();

    blocks.push(...response.content);
    // The server-side tool loop pauses after a set number of iterations:
    // send the turn so far back unchanged and it carries on where it stopped.
    if (response.stop_reason !== 'pause_turn') break;
    messages.splice(1, messages.length - 1, { role: 'assistant', content: [...blocks] });
  }

  if (response.stop_reason === 'refusal') throw new Error('research step was refused');
  if (response.stop_reason === 'pause_turn') throw new Error('research did not finish within the continuation limit');

  // The write-up is the text after the last tool call; earlier text is
  // running commentary between searches.
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

// Step 2: turn the write-up into the exact JSON the site renders.
async function structure(api, notes) {
  const response = await api.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: 'low', format: zodOutputFormat(AccaSchema) },
    messages: [
      {
        role: 'user',
        content:
          'Convert this accumulator write-up into the JSON schema. Copy selections, reasoning, ' +
          'numbers, odds and URLs faithfully; do not add anything that is not in the write-up. ' +
          `Each leg must have exactly two props.\n\n<writeup>\n${notes}\n</writeup>`,
      },
    ],
  });
  if (!response.parsed_output) throw new Error(`structuring failed (stop_reason ${response.stop_reason})`);
  return response.parsed_output;
}

// `api` is injectable so tests can run without a key or network.
export async function generateAcca(date, ctx, api = client()) {
  const notes = await research(api, date, ctx);
  const acca = await structure(api, notes);
  return {
    date,
    gameweek: ctx?.gameweek ?? null,
    generated_at: new Date().toISOString(),
    ...acca,
  };
}
