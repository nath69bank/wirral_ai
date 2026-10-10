// Fixtures and player form from the public Fantasy Premier League API.
// No key needed. If it is unreachable the generator still runs: the model
// finds the fixtures itself with web search.

import { ukDate } from './dates.js';

const BASE = 'https://fantasy.premierleague.com/api';
const UA = { 'User-Agent': 'cmd-shift-cash/1.0' };

async function getJSON(path) {
  const res = await fetch(`${BASE}${path}`, { headers: UA, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`FPL ${path} -> HTTP ${res.status}`);
  return res.json();
}

export function ukTime(d) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

const POSITIONS = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };

// Returns { gameweek, fixtures: [{home, away, kickoff_uk, kickoff_iso}], players: {team: [...]}}
// for Premier League fixtures on `date` (UK calendar day). Players are the most-used
// outfielders for each team involved, with the season numbers FPL publishes.
export async function getDayContext(date) {
  const [boot, fixtures] = await Promise.all([getJSON('/bootstrap-static/'), getJSON('/fixtures/')]);
  const teams = new Map(boot.teams.map((t) => [t.id, t.name]));

  const today = fixtures
    .filter((f) => f.kickoff_time && ukDate(new Date(f.kickoff_time)) === date)
    .sort((a, b) => a.kickoff_time.localeCompare(b.kickoff_time));

  const teamIds = new Set(today.flatMap((f) => [f.team_h, f.team_a]));
  const players = {};
  for (const id of teamIds) {
    players[teams.get(id)] = boot.elements
      .filter((p) => p.team === id && p.element_type !== 1 && p.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 14)
      .map((p) => ({
        name: p.web_name,
        pos: POSITIONS[p.element_type],
        status: p.status, // a = available, d = doubtful, i = injured, s = suspended, u = unavailable
        news: p.news || '',
        chance_next: p.chance_of_playing_next_round,
        starts: p.starts,
        minutes: p.minutes,
        goals: p.goals_scored,
        assists: p.assists,
        xg: p.expected_goals,
        yellows: p.yellow_cards,
        reds: p.red_cards,
        form: p.form,
      }));
  }

  return {
    gameweek: today[0]?.event ?? null,
    fixtures: today.map((f) => ({
      home: teams.get(f.team_h),
      away: teams.get(f.team_a),
      kickoff_uk: ukTime(new Date(f.kickoff_time)),
      kickoff_iso: f.kickoff_time,
    })),
    players,
  };
}
