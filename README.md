# personal-finance

AI-powered personal finance toolkit that fetches bank transactions via Open Finance, classifies expenses, recognizes income, and generates monthly budget reports — all orchestrated through Claude Code skills.

## Skills

This project uses Claude Code skills (`.claude/skills/`) to automate the monthly budget workflow. Each skill can be invoked directly or orchestrated by `/compile`.

### `/compile` — Orchestrator

Runs the full monthly budget pipeline end-to-end. It calls each skill below in sequence, computes budget buckets, and generates a JSON report.

**Usage:** `/compile` for the target month.

### `/fetch` — Transaction Fetcher

Connects to the [Pluggy](https://pluggy.ai) Open Finance API to download all BANK and CREDIT CARD transactions for a target month. Authenticates with your credentials, pulls transactions for all connected accounts, normalizes them into a unified format, and saves to `resources/{YYYY-MM}/expenses/transactions_raw.json`.

Falls back to manual CSV parsing if Pluggy is unavailable.

### `/recognize` — Income Recognition

Scans savings account movements to identify income: salary, cashback, IOF adjustments, investment yields, and named transfers. Uses amount + date window rules defined in `resources/income_inputs.md` to match salary deposits. Skips internal transfers and CC bill payments to avoid double counting.

For partial months, provisions expected salary that hasn't arrived yet.

### `/categorize` — Expense Classification

Classifies every expense transaction into categories (Groceries, Housing, Health, Transportation, etc.) using merchant-to-category mappings from `resources/expenses_memory.md`. Handles refunds by netting them against the original category, tracks small auto-investments (Troco Turbo) separately, and flags unmatched transactions as uncategorized for user review.

After classification, updates the merchant memory file with any new mappings.

### `/provision` — Recurring Expense Estimator

For partial months only. Estimates recurring fixed costs (rent, utilities, subscriptions, insurance) that haven't appeared yet based on the last 2 completed months. Each item is provisioned individually — never bundled. Checks `expenses_memory.md` to know which subscriptions are active vs cancelled.

### `/forecast` — Partial Month Projector

Orchestrates `/recognize` (salary provisioning) + `/provision` (expense estimates) to project a full-month budget from partial data. All provisioned items are tagged with `provisional: true` and are automatically replaced by actuals when the month is re-compiled with complete data.

## Connecting to Pluggy (Open Finance)

The `/fetch` skill uses [Pluggy](https://pluggy.ai) to pull bank transactions via Brazil's Open Finance ecosystem. Follow these steps to set it up:

### Step 1: Create a MeuPluggy account

1. Go to [meu.pluggy.ai](https://meu.pluggy.ai) and sign up
2. Connect your bank accounts — select your financial institution and authorize via Open Finance
3. Once connected, Pluggy will have access to your checking accounts, savings, credit cards, and transactions

> If you have multiple banks, you'll need to authorize each one separately.

### Step 2: Create a Developer account

1. Go to [dashboard.pluggy.ai](https://dashboard.pluggy.ai) and register (includes a 15-day free trial)
2. Create a new application to get your `client_id` and `client_secret`

### Step 3: Link your MeuPluggy account to the Developer app

1. In the Pluggy Dashboard, go to the Demo application
2. Use OAuth authorization to connect your MeuPluggy account
3. This creates an **Item** for each connected bank — note down the Item IDs

> Full walkthrough: [github.com/pluggyai/meu-pluggy](https://github.com/pluggyai/meu-pluggy)

### Step 4: Configure credentials locally

Create a `.env.local` file at the project root:

```env
PLUGGY_CLIENT_ID=your_client_id_here
PLUGGY_CLIENT_SECRET=your_client_secret_here
PLUGGY_ITEM_IDS=item_id_1,item_id_2
```

### Step 5: Run your first fetch

```
/fetch
```

On the first run, the skill will list all accounts for each Item and ask you to map them to household members. This mapping is saved to `resources/pluggy_items.json` for future runs.

## Project Structure

```
resources/
  expenses_memory.md          # Merchant-to-category mappings and budget rules
  income_inputs.md            # Salary definitions and income source rules
  pluggy_items.json           # Pluggy account-to-holder mapping
  {YYYY-MM}/
    expenses/
      transactions_raw.json   # Normalized transactions (from /fetch)
      result/
        budget_{month}_{year}.json  # Final budget report (from /compile)
.claude/
  skills/                     # Claude Code skill definitions
.env.local                    # Pluggy API credentials (not committed)
```

## Requirements

- [Claude Code](https://claude.ai/claude-code) CLI
- A [Pluggy](https://pluggy.ai) account with connected bank accounts (or manual CSVs)
- Node.js (for API calls)
