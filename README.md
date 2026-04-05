# personal-finance

> **Let your agents do the work.** Connect your bank accounts, run `/compile`, and get a full monthly budget report — no spreadsheets, no manual entry.

AI-powered personal finance toolkit that fetches bank transactions via Open Finance, classifies expenses, recognizes income, and generates monthly budget reports — all orchestrated through Claude Code skills.

Looking for the web dashboard? See [personal-finance-viewer](https://github.com/icesnow10/personal-finance-viewer) — a standalone Next.js app that visualizes the budget JSONs this project generates.

## Skills

| Skill | What it does |
|---|---|
| `/onboard` | **Start here.** Creates household folder, `.env.local`, memory files, and runs `/accounts` if credentials are set. |
| `/accounts` | Auto-detects holder (Identity API), bank (Item API), and account numbers (Accounts API) for each Pluggy item. Saves `pluggy_items.json`. |
| `/compile` | Orchestrates the full pipeline: `/fetch` → `/recognize` → `/categorize` → `/forecast` (if partial) → `/advise` → `/notify`. Produces a JSON budget report. |
| `/fetch` | Runs `/accounts` first, then connects to Pluggy API to download BANK + CREDIT transactions. Normalizes into `resources/{household}/{YYYY-MM}/expenses/transactions_raw.json`. Falls back to CSV parsing. |
| `/recognize` | Identifies income from savings account movements — salary, cashback, IOF adjustments, yields, named transfers. Matches salary by amount + date window rules from `income_memory.md`. |
| `/categorize` | Classifies expenses into categories using merchant mappings from `expenses_memory.md`. Handles refunds, RDB, and flags uncategorized items. |
| `/classify` | Classifies specific transactions (not whole-month). Updates `expenses_memory.md` and `income_memory.md` with new patterns. |
| `/provision` | Partial months only. Estimates recurring fixed costs not yet charged, based on last 2 completed months. |
| `/forecast` | Partial months only. Combines `/recognize` (salary provisioning) + `/provision` (expense estimates). |
| `/heartbeat` | Periodic pulse — fetches new transactions, appends, re-compiles preserving classifications. Fully unattended. |
| `/settle` | Finalizes previous month (strips provisional items), then triggers `/heartbeat` for current month. |
| `/advise` | Analyzes compiled budget → health checks, category spotlights, momentum, wins/alerts, recommendations. |
| `/notify` | Sends insights via Telegram. Skips silently if not configured. |
| `/transactions` | Lists all transactions for a month in a markdown table. |
| `/classified` | Lists only classified transactions grouped by category. |
| `/missing` | Lists only uncategorized transactions. |

## Quick Start

```
/onboard
```

The wizard will:
1. Ask for a household name
2. Create `resources/{household}/` with `.env.local`, `expenses_memory.md`, `income_memory.md`
3. Run `/accounts` if Pluggy credentials are filled in
4. Tell you to run `/compile` next

## Household

All data is scoped by **household** — a short lowercase name chosen during `/onboard`. Multiple households coexist:

```
resources/
  household-1/
    .env.local
    expenses_memory.md
    income_memory.md
    pluggy_items.json
    2026-04/
      expenses/
        transactions_raw.json
        result/
          budget_apr_2026.json
          insights_*.json
  household-2/
    .env.local
    ...
```

## Installing as a Marketplace Plugin

```bash
# 1. Add this marketplace (one-time per project)
/plugin marketplace add icesnow10/personal-finance

# 2. Install the plugin
/plugin install open-personal-finance@personal-finance
```

Alternatively, add the marketplace to your project's `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "personal-finance": {
      "source": { "source": "github", "repo": "icesnow10/personal-finance" }
    }
  }
}
```

## Credentials

Each household has its own `resources/{household}/.env.local`:

```env
# Required — from dashboard.pluggy.ai
PLUGGY_CLIENT_ID=your_client_id
PLUGGY_CLIENT_SECRET=your_client_secret
PLUGGY_ITEM_IDS=item_id_1,item_id_2

# Optional — for /notify via Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

## Viewer

Want a web dashboard? See [personal-finance-viewer](https://github.com/icesnow10/personal-finance-viewer) — a standalone Next.js app that visualizes the budget JSONs this project generates. Point it to your `resources/` folder and you're set.

![personal-finance-viewer dashboard](docs/images/viewer-overview.png)
