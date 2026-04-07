# personal-finance

> Let your agents do the work. Connect your bank accounts, run `/compile`, and get a flat monthly transaction file ready for the viewer.

AI-powered personal finance toolkit that fetches bank transactions via Open Finance, classifies expenses, recognizes income, and generates flat monthly budget result files through Claude Code skills.

Looking for the web dashboard? See [personal-finance-viewer](https://github.com/icesnow10/personal-finance-viewer). It reads the flat month files from this project and handles grouping, totals, and visualization.

## Skills

| Skill | What it does |
|---|---|
| `/onboard` | Creates household folders, `.env.local`, memory files, and runs `/accounts` if credentials are set. |
| `/accounts` | Detects holder, bank, and account metadata for each Pluggy item and saves `pluggy_items.json`. |
| `/fetch` | Pulls BANK + CREDIT transactions from Pluggy and writes `resources/{household}/{YYYY-MM}/expenses/transactions_pluggy_raw.json`. |
| `/compile` | Runs `/fetch` -> `/recognize` -> `/categorize` -> `/forecast` and writes `result/budget_{month}_{year}.json` as a top-level flat JSON array of transaction rows. |
| `/recognize` | Marks income and skipped internal movements from the month's Pluggy raw transactions. |
| `/categorize` | Classifies expense rows with `bucket`, `category`, and `subcategory`. |
| `/classify` | Classifies specific transactions and updates memory files. |
| `/provision` | Estimates recurring fixed costs for partial months. |
| `/forecast` | Combines income provisioning and recurring expense provisioning for partial months. |
| `/heartbeat` | Fetches new Pluggy rows for the current month and recompiles without losing prior classifications. |
| `/settle` | Finalizes the previous month, removes all provisional rows from the closed month, then runs `/heartbeat` for the current month. |
| `/audit` | Validates schema of raw and compiled files; auto-fixes issues and retries up to 3 times. Called by `/fetch` and `/heartbeat`. |
| `/advise` | Generates budget insights. |
| `/notify` | Sends Telegram notifications when configured. |
| `/transactions` | Lists rows from the flat month result. |
| `/classified` | Lists classified expense rows from the flat month result. |
| `/missing` | Lists rows still marked as `unclassified`. |

## Household Layout

```text
resources/
  household-1/
    .env.local
    expenses_memory.md
    income_memory.md
    pluggy_items.json
    2026-04/
      expenses/
        transactions_pluggy_raw.json
        result/
          budget_apr_2026.json
          insights_*.json
```

## Data Contract

Source of truth before compile:
- `resources/{household}/{YYYY-MM}/expenses/transactions_pluggy_raw.json`

Final month output:
- `resources/{household}/{YYYY-MM}/expenses/result/budget_{month}_{year}.json`

Rules:
- use `transactions_pluggy_raw.json` as the only month source file
- no nested category trees in the result file
- no summaries or bucket rollups in the result file
- one top-level flat JSON array only
- the viewer handles grouping and totals

## Credentials

Each household has its own `resources/{household}/.env.local`:

```env
PLUGGY_CLIENT_ID=your_client_id
PLUGGY_CLIENT_SECRET=your_client_secret
PLUGGY_ITEM_IDS=item_id_1,item_id_2

TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```
