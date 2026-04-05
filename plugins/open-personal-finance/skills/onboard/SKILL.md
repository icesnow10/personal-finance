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

```markdown
# Expenses Memory

## Known Merchants

| Merchant Pattern | Category | Subcategory | Notes |
|---|---|---|---|

## Manual Overrides

| Description | Category | Subcategory | Notes |
|---|---|---|---|

## Budget Buckets

| Bucket | Target % | Categories |
|---|---:|---|
| Custos Fixos (Essencial) | 30% | Housing, Health, Insurance, Groceries, Transportation |
| Conforto (Estilo de vida) | 25% | Wellness, Subscriptions, Personal Care, Services, Food/Dining, Recreation, Shopping, Travel, Family Support |
| Liberdade Financeira | 45% | Investment (Troco Turbo), Net |

## RDB Threshold

Intentional RDB threshold: R$ 5,000.00 (amounts above this are intentional lump-sum investments, not auto Troco Turbo)

## Active Subscriptions

| Service | Expected Amount | Holder | Notes |
|---|---|---|---|

## Cancelled Subscriptions

| Service | Cancelled Since | Notes |
|---|---|---|
```

#### `income_memory.md`

```markdown
# Income Memory

## Salary Definitions

| Holder | Label | Expected Amount | Range (min-max) | Date Window | Frequency | Bank |
|---|---|---|---|---|---|---|

## Other Known Income Sources

| Pattern | Classification | Notes |
|---|---|---|
```

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
