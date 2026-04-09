---
name: onboard
description: Interactive setup wizard for new users. Creates the household folder structure, initializes memory files and .env.local, and runs /accounts if credentials are set. Use when a new user wants to get started or says "setup", "onboard", "get started", or "first time".
---

# Onboard — First-Time Setup Wizard

Guides a new user through the complete setup process for a new household.

## Flow

Run each step in order. Do not skip ahead.

### Step 1: Choose household name

Ask the user:

> **Choose a name for your household** (lowercase, no spaces — e.g. "household-1", "household-2"). This name scopes all your financial data so multiple households can coexist.

Store the `{household}` name — it's used in all paths below.

### Step 2: Create folder structure

Create the base directory:

```
resources/{household}/
```

### Step 3: Initialize files

Create the following files inside `resources/{household}/`:

#### `.env.local`

```
PLUGGY_CLIENT_ID=
PLUGGY_CLIENT_SECRET=
PLUGGY_ITEM_IDS=

TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

Tell the user:

> **Fill in your Pluggy credentials** in `resources/{household}/.env.local`:
> - `PLUGGY_CLIENT_ID` and `PLUGGY_CLIENT_SECRET` from [dashboard.pluggy.ai](https://dashboard.pluggy.ai)
> - `PLUGGY_ITEM_IDS` — comma-separated Item IDs from your connected banks
> - `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are optional (for `/notify`)

#### `expenses_memory.md`

Copy the template from `plugins/open-personal-finance/templates/expenses_memory.example.md` into `resources/{household}/expenses_memory.md`.

Walk through the template with the user:
- **Budget Buckets**: ask if the default percentages (25% Custos Fixos, 30% Conforto, 45% Liberdade Financeira) work for them, or if they want to adjust
- **Known Merchants**: explain these will grow automatically via `/learn` as they process months
- **Manual Overrides**: explain these are for when auto-classification gets it wrong
- **Active Subscriptions**: ask the user to fill in their recurring subscriptions (Netflix, Spotify, gym, etc.) so `/provision` can estimate partial months
- Replace placeholder names (RENT COMPANY, SUPERMARKET A, etc.) with the user's actual merchants as they discover them — or leave them as examples that `/learn` will replace over time

#### `income_memory.md`

Copy the template from `plugins/open-personal-finance/templates/income_memory.example.md` into `resources/{household}/income_memory.md`.

Walk through the template with the user:
- **Salary Definitions**: ask for each household member's salary details (expected amount, range, which days it usually posts)
- **Other Known Income**: ask about FGTS, PLR, 13th salary, freelance income, etc.
- Replace placeholder values with the user's actual data

### Step 4: Run /accounts (if credentials are set)

Read `resources/{household}/.env.local`. Check if `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET`, and `PLUGGY_ITEM_IDS` are filled in (non-empty).

**If set:** Run `/accounts` to auto-detect holders and banks for each Pluggy item. This saves `resources/{household}/pluggy_items.json`.

**If not set:** Tell the user:

> Pluggy credentials are not configured yet. Fill in `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET`, and `PLUGGY_ITEM_IDS` in `resources/{household}/.env.local`, then run `/accounts` manually.

### Step 5: Done

Summarize what was set up:
- Household `{household}` folder created
- `.env.local`, `expenses_memory.md`, `income_memory.md` initialized
- `pluggy_items.json` saved (if credentials were set) — holders and banks auto-detected
- Next step: run `/compile` to fetch transactions and generate the first budget

## Rules

- Be conversational and guide the user step by step
- Never proceed to the next step without user confirmation
- If files already exist, ask before overwriting
