# Acca Lab

A Premier League accumulator, built automatically on every matchday and published as a static site.

Each acca follows the same format: **3 legs**, one per fixture. Each leg has a **match win or double chance**, plus **two more selections** (shots on target, cards, fouls, corners, goals). Every pick comes with the stats behind it, an estimated price, and what to check on the team sheet. Each acca also lists a safer and a bigger version, plus the games left out and why.

## How it works

1. **GitHub Action** (`.github/workflows/acca.yml`) runs every day at 09:17 UTC.
2. `scripts/generate.js` asks the free **Fantasy Premier League API** for that day's fixtures. If there are none, it stops at no cost. If there are, it collects each team's most-used players with their FPL season stats (minutes, goals, xG, yellow cards) and injury status.
3. **Claude** (`lib/acca.js`) researches with web search and web fetch: team news, confirmed or predicted XIs, Opta / The Analyst stats, and bookmaker previews. It then writes the acca. A second, cheap call turns that write-up into the JSON in `lib/schema.js`.
4. The acca is saved to `data/accas/<date>.json`, `data/index.json` is updated, and the bot commits. Your host (Vercel or GitHub Pages) redeploys and the new acca goes live. Older accas stay in the archive dropdown.

## Setup (one-off)

1. **API key:** in GitHub, go to *Settings → Secrets and variables → Actions → New repository secret*. Name it `ANTHROPIC_API_KEY` and paste your key from console.anthropic.com.
2. **Hosting:** import this repo into Vercel (no build settings needed, it's static). Alternatively, turn on GitHub Pages for the default branch.
3. **Merge to the default branch:** scheduled Actions only run there.
4. **Test it:** go to *Actions → Build matchday acca → Run workflow*. You can pick a date and tick *force* to rebuild an existing one.

Optional repository variables / env vars: `ANTHROPIC_MODEL` (default `claude-opus-5-5`) and `ACCA_LEGS` (default `3`).

## Running locally

```bash
npm install
ANTHROPIC_API_KEY=sk-ant-... npm run generate -- --date 2026-10-17
npm run serve        # http://localhost:3000
npm test             # offline tests, no key needed
```

## Cost

A matchday costs one research call (up to 25 searches and 15 page fetches) plus one small structuring call. Expect roughly $0.50–$2 per matchday. Blank days cost nothing.

## Limits worth knowing

- The morning run comes before the team sheets (published about an hour before kick-off). Player picks use predicted XIs, and every leg says which players must be confirmed.
- Prices are estimates taken from previews, not a live odds feed. A bet builder will price linked selections in the same game lower.
- This is research, not a guarantee. 18+, gamble responsibly: [BeGambleAware](https://www.begambleaware.org/).
