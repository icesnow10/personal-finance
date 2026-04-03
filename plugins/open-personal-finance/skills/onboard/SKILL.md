---
name: onboard
description: Interactive setup wizard for new users. Creates the project structure, walks through Pluggy account connection, configures credentials, sets up household members, and runs the first budget compilation. Use when a new user wants to get started or says "setup", "onboard", "get started", or "first time".
---

# Onboard — First-Time Setup Wizard

Guides a new user through the complete setup process, from zero to their first compiled budget.

## Flow

Run each step in order. Ask the user for input where indicated. Do not skip ahead.

### Step 1: Create project structure

Create the base directories and template files if they don't exist:

```
resources/
  expenses_memory.md
  income_inputs.md
```

**`resources/expenses_memory.md`** — initialize with:

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

**`resources/income_inputs.md`** — initialize with:

```markdown
# Income Inputs

## Salary Definitions

| Holder | Label | Expected Amount | Range (min-max) | Date Window | Frequency |
|---|---|---|---|---|---|

## Other Known Income Sources

| Pattern | Classification | Notes |
|---|---|---|
```

### Step 2: Household members

Ask the user:

> **Who are the members of your household?** Each person who has bank accounts to track. I need a short name (lowercase, no spaces) for each. For example: "michel", "carol".

Store the answer — it will be used in the next steps.

### Step 3: Salary setup

For each household member, ask:

> **What is {name}'s monthly net salary?** (approximate amount in R$)
> **Around which day of the month does it usually arrive?** (e.g., "5th", "last business day")

Fill in `resources/income_inputs.md` with the salary definitions. Use a ±10% range around the expected amount and a ±3 day window around the expected date.

### Step 4: Pluggy connection

Ask the user:

> **Do you want to connect via Pluggy (Open Finance) or use manual CSVs?**

#### If Pluggy:

Walk through these steps interactively:

1. **MeuPluggy account** — "Do you already have a MeuPluggy account at meu.pluggy.ai? If not, go create one and connect your bank accounts. Let me know when you're done."

2. **Developer account** — "Now go to dashboard.pluggy.ai and create a developer account (free for personal use). Create an application and copy the `client_id` and `client_secret`. Paste them here."

3. **Create `.env.local`** — Write the credentials file:
   ```
   PLUGGY_CLIENT_ID=<user-provided>
   PLUGGY_CLIENT_SECRET=<user-provided>
   PLUGGY_ITEM_IDS=<user-provided>
   ```

4. **Item IDs** — "In the Pluggy Dashboard, open your Demo app. For each connected bank, click the ⋮ menu and select 'Copy Item ID'. Paste all Item IDs here (comma-separated if multiple)."

5. **Update `.env.local`** with the Item IDs.

#### If manual CSVs:

Explain the expected file format and naming:

> Place your bank statement CSVs in `resources/{YYYY-MM}/expenses/input/`:
> - **Credit card:** `cc-{holder}-{anything}.csv` with columns `date,title,amount`
> - **Savings account:** `savings-{holder}-{anything}.csv` with columns `Data,Valor,Identificador,Descricao`

### Step 5: First fetch

Run `/fetch` for the current month. This will:
- Authenticate with Pluggy (or read CSVs)
- Download all transactions
- Ask the user to map accounts to household members (first run only)
- Save `resources/pluggy_items.json` and `transactions_raw.json`

### Step 6: First compile

Run `/compile` for the current month. This will:
- Recognize income
- Categorize expenses (many will be uncategorized on the first run)
- Present uncategorized transactions for the user to review
- Update `expenses_memory.md` with new merchant mappings
- Generate the budget JSON

### Step 7: Telegram notifications (optional)

Ask the user:

> **Want to receive budget insights on Telegram?** You'll get a summary after each `/compile` with your budget health, warnings, and recommendations.

#### If yes:

1. **Create a bot** — "Open Telegram, search for @BotFather, and send `/newbot`. Follow the steps to create a bot. Paste the **token** here."

2. **Save the token** — Write `TELEGRAM_BOT_TOKEN=<token>` to `.env.local`.

3. **Get the chat ID** — "Now open your new bot in Telegram (the BotFather gives you a link) and send any message. Let me know when you've done that."

4. **Fetch chat ID** — Call `GET https://api.telegram.org/bot<token>/getUpdates` to find the user's `chat.id`.

5. **Save the chat ID** — Append `TELEGRAM_CHAT_ID=<chat_id>` to `.env.local`.

6. **Send test message** — Send a message via the bot API to confirm it works:
   > "Expense Advisor conectado! Vou te enviar insights sobre seu orcamento mensal."

#### If no:

Skip — `/compile` will detect missing Telegram credentials and skip notifications automatically.

### Step 8: Viewer setup (optional)

Ask the user:

> **Want to visualize your budget in a web dashboard?** Check out [personal-finance-viewer](https://github.com/icesnow10/personal-finance-viewer) — clone it, run `npm install && npm run dev`, then point it to your `resources/` folder in Settings.

### Step 9: Done

Summarize what was set up:
- Household members configured
- Salary definitions saved
- Pluggy connected (or CSV fallback ready)
- First month fetched and compiled
- Telegram notifications (if configured)
- How to run next month: just `/compile`

## Rules

- Be conversational and guide the user step by step
- Never proceed to the next step without user confirmation
- If the user gets stuck on Pluggy setup, offer the CSV fallback
- Do not hardcode any real financial data — always ask the user
- If files already exist, ask before overwriting
