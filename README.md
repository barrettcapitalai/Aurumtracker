# AURUM / NEYRO Wallet Tracker

24/7 on-chain monitor for the AURUM/NEYRO wallet set on BNB Chain.
Live dashboard + a background job every 15 minutes that pushes alerts to Telegram:

- 🚨 EXCHANGE — a watched wallet sent/received funds to/from a known exchange
- ⚠️ LARGE OUT — outflow above your USDT threshold
- 🔄 INTERNAL / 📉 BALANCE DROP — logged to the dashboard feed only (not sent to Telegram; change TELEGRAM_ALERT_TYPES in lib/shared.mjs to enable)

## Deploy (10 minutes)

### 1. Create the Telegram bot
1. In Telegram, message **@BotFather** → send `/newbot` → pick a name → copy the **bot token**.
2. Open a chat with your new bot and send it any message (required before it can message you).
3. Get your chat ID: message **@userinfobot** — it replies with your numeric ID.
   (For a group: add the bot to the group, then use @RawDataBot or the getUpdates API; group IDs start with `-`.)

### 2. Push this folder to GitHub
Create a new repo, upload all files (keep the folder structure).

### 3. Deploy on Netlify
1. app.netlify.com → **Add new site → Import an existing project** → pick the repo.
2. Build settings are auto-read from `netlify.toml` (publish dir `public`, no build command). Deploy.

### 4. Set environment variables
Site settings → **Environment variables** → add:

| Key | Value |
|---|---|
| `ETHERSCAN_KEY` | your free key from etherscan.io/apis |
| `NANSEN_KEY` | your Nansen API key |
| `TELEGRAM_BOT_TOKEN` | from BotFather |
| `TELEGRAM_CHAT_ID` | your numeric ID |
| `ALERT_THRESHOLD_USDT` | `2000` (key wallets are set tighter, $500, in `lib/shared.mjs`) |

Then **redeploy** (Deploys → Trigger deploy) so functions pick up the vars.

### 5. Verify
- Open your site → press **Send Telegram test** → you should get a message.
- Netlify → Logs → Functions → `monitor` shows a run every 15 minutes.
- To change the schedule, edit `export const config = { schedule: "*/15 * * * *" }` in `netlify/functions/monitor.mjs` (currently every 5 minutes).

## Editing the watchlist
All wallets and tagged exchanges live in **`lib/shared.mjs`** — one file, used by the
dashboard, the scanner, and the monitor. Add/remove entries and redeploy.

## Notes
- Contract addresses (`isContract: true`) display balances but are excluded from tx scanning.
- Keys never reach the browser; all third-party calls go through serverless functions.
- Nansen counterparty pulls cost 5 credits each; labeled data shown is provided by Nansen.
