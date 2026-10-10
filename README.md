# CMD + SHIFT + CASH ⌘ ⇧ $

AI-researched value bets for **football, horse racing, UFC/MMA and boxing**. Every day it posts up to three bets, one per key:

| Key | Tier | Price | Stake |
|---|---|---|---|
| ⌘ **CMD** | Small | around 4/1 (3/1 to 6/1) | 1pt |
| ⇧ **SHIFT** | Medium | 20/1+ | 0.5pt |
| $ **CASH** | Gamble | 100/1+ | 0.25pt |

A tier is only posted when the research finds value (estimated chance higher than the price implies). Bets outside a tier's price band are rejected automatically.

## How it works

```
GitHub Action (08:15 UTC daily)
  └─ scripts/daily.js
       1. Settle: earlier pending bets → Claude checks results → won/lost/void/placed → results posted to Telegram
       2. Pick:   FPL feed (Premier League fixtures + player stats) + Claude web research
                  (team news, line-ups, racecards, fight cards, Opta / Racing Post / UFC Stats…)
                  → up to 3 bets → saved to private Vercel Blob storage
       3. Post:   full bets → premium Telegram group; teasers (tier, price, no selections) → free channel

Website (Vercel)
  public/          the site
  api/card.js      today's bets: full for members, locked teasers for everyone else; past days public (track record)
  api/checkout.js  Stripe Checkout (subscription)
  api/auth.js      sign-in after checkout, email sign-in links, sign out, Stripe billing portal
  api/telegram.js  members get a single-use 24-hour invite link to the premium group
```

Membership is an active Stripe subscription. There's no database: the member cookie is signed with `SESSION_SECRET` and re-checked with Stripe when the paid period ends.

**This repo is public**, so bets never go in git. They're stored in a *private* Vercel Blob store, and the Action logs show only tiers and prices.

## Setup

### 1. Vercel (site + storage)
1. Import this repo into Vercel. No build settings are needed (`vercel.json` serves `public/` and `api/`).
2. Go to **Storage → Create → Blob** and pick **private** access. Connect it to the project; this adds `BLOB_READ_WRITE_TOKEN`.
3. Add environment variables:

| Variable | What |
|---|---|
| `SESSION_SECRET` | a random string, 32+ characters (`openssl rand -hex 32`) |
| `SITE_URL` | e.g. `https://cmdshiftcash.com` |
| `PRICE_LABEL` | shown on the site, e.g. `£19.99/month` |
| `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID` | see step 2 |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_PREMIUM_CHAT_ID` | see step 3 (for member invite links) |
| `RESEND_API_KEY`, `EMAIL_FROM` | see step 4 |

### 2. Stripe (payments)
1. Create a product, "CMD + SHIFT + CASH Premium", with a recurring monthly price. Copy the price ID (`price_…`) into `STRIPE_PRICE_ID`.
2. Copy your secret key into `STRIPE_SECRET_KEY`.
3. Turn on the **Customer portal** (Settings → Billing → Customer portal) so members can cancel or update their card.

### 3. Telegram
1. Message **@BotFather**, send `/newbot`, and copy the token into `TELEGRAM_BOT_TOKEN`.
2. Create a **private group** for premium members. Add the bot as an **admin** with "Invite users via link" turned on.
3. Optional: create a **public channel** for free teasers and results. Add the bot as an admin with "Post messages" turned on.
4. Get each chat ID: post a message in the chat, open `https://api.telegram.org/bot<TOKEN>/getUpdates`, and copy `chat.id` (it starts with `-100`). These are `TELEGRAM_PREMIUM_CHAT_ID` and `TELEGRAM_FREE_CHAT_ID`.

### 4. Email sign-in links (Resend)
Sign up at resend.com, verify your domain, and set `RESEND_API_KEY` and `EMAIL_FROM` (e.g. `CMD + SHIFT + CASH <bets@yourdomain.com>`).

### 5. GitHub Action (the daily run)
In this repo, go to **Settings → Secrets and variables → Actions** and add:
- Secrets: `ANTHROPIC_API_KEY`, `BLOB_READ_WRITE_TOKEN` (the same token Vercel shows), `TELEGRAM_BOT_TOKEN`, `TELEGRAM_PREMIUM_CHAT_ID`, `TELEGRAM_FREE_CHAT_ID`
- Variable: `SITE_URL`

Test it from **Actions → Daily bets → Run workflow**. Scheduled runs only fire from the default branch.

## Local preview

```bash
npm install
npm test                                              # offline, no keys needed
SESSION_SECRET=$(openssl rand -hex 32) npm run dev    # http://localhost:3000, cards read from ./.data
ANTHROPIC_API_KEY=... npm run daily -- --no-post      # real research run, saved to ./.data, nothing posted
```

## Running costs (rough)
- Claude: about $1–3 a day (one research run plus one settlement run, each with web search)
- Vercel Hobby, Blob, GitHub Actions, Telegram: free at this scale
- Stripe: per-transaction fees; Resend: free tier

## Things to know
- **Bets are posted, not placed.** Bookmakers don't offer APIs for placing bets on personal accounts. The service researches, builds and publishes the bet, and members place it themselves.
- **Prices are estimates** from previews at research time. Each bet says what to check (team sheets, non-runners, weigh-ins).
- **Lapsed members in Telegram:** invite links are single-use and expire after 24 hours, but members who cancel stay in the group until removed. Prune the group manually for now.
- **UK rules:** paid tipping services must follow the CAP Code (no "guaranteed winners", clear 18+ messaging, no appeal to under-18s). If you add bookmaker affiliate links, the bookmaker's licence conditions apply to you too. Take advice before launch.
