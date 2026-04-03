---
name: compile
description: Generate a monthly budget report by running /fetch (Pluggy API), then orchestrating /recognize (income), /categorize (expenses), and /forecast (provisioning for partial months). Produces JSON output. Use when the user asks to generate, create, or analyze a monthly budget, expenses, or income.
---

# Compile Budget

Orchestrates the full monthly budget pipeline: fetch/read -> recognize income -> categorize expenses -> forecast (if partial) -> generate output.

## Reference Files (in `resources/`)

| File | Purpose |
|---|---|
| `resources/expenses_memory.md` | Merchant-to-category mappings, manual overrides, known merchants, budget bucket definitions, RDB thresholds |
| `resources/income_inputs.md` | Salary definitions (amounts, ranges, date windows), other known income sources |

## Pipeline

### 1. Fetch transactions — run /fetch

Run `/fetch` for the target month. This connects to Pluggy API (or falls back to CSVs), downloads all BANK + CREDIT transactions, and saves normalized data to `resources/{YYYY-MM}/expenses/transactions_raw.json`.

After `/fetch` completes, read `transactions_raw.json` and proceed.

### 2. Run /recognize

Apply income recognition rules from `income_inputs.md` to identify:
- **Income items** (salary, cashback, transfers received, adjustments)
- **Skipped transfers** (internal movements, prior-month clearing, CC bill payments)

For partial months, `/recognize` provisions expected salary using definitions in `income_inputs.md`.

### 3. Run /categorize

Apply expense classification using `expenses_memory.md` to all non-income, non-skipped transactions:
- **Categorized expenses** by category and subcategory
- **Investment (Troco Turbo)** — small auto RDB applications
- **Intentional RDB** — large lump-sum investments (NOT in expense totals, threshold in `expenses_memory.md`)
- **Uncategorized** — flagged for user review

After classification, update `resources/expenses_memory.md` with any new merchant mappings.

### 4. Run /forecast (partial months only)

If `partial: true`, run `/forecast` which orchestrates `/recognize` (salary provisioning) + `/provision` (recurring expense estimates). Skip for complete months.

### 5. Compute summary

- `Total Income` = sum of all income items (including provisioned for partial months)
- `Total Expenses` = sum of all categorized + uncategorized + Investment (Troco Turbo)
- `Net = Total Income - Total Expenses`
- `Investment = Troco Turbo + max(0, Net)`
- Intentional RDB tracked separately, NOT in totals

### 6. Compute budget buckets

Bucket definitions (target %, categories) are stored in `resources/expenses_memory.md`. Read them from there — do not hardcode.

### 7. Generate output

Write to `resources/{YYYY-MM}/expenses/result/`:
- **`budget_{month}_{year}.json`** — structured JSON matching `BudgetData` type (see `src/lib/types.ts`)

### 8. User review

Present uncategorized transactions for the user to assign categories. After review, update output files and `expenses_memory.md`.

### 9. Run /advise + /notify (if Telegram configured)

After the budget JSON is generated:

1. **Run `/advise`** — analyze the budget and generate insights (health check, spotlight categories, pace, wins/warnings, recommendations)
2. **Run `/notify`** — send the insights summary via Telegram

Both steps are **optional** — if `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are not set in `.env.local`, skip silently. Never error or prompt the user about Telegram configuration during compile.

## Output Format

### Key Rules

- All dates in `YYYY-MM-DD` format
- Refunds allocated to their original category (not a separate section)
- **Investment (Troco Turbo) is an expense category**, included in Total Expenses
- **Intentional large RDB** tracked separately, NOT in expense totals (threshold in `expenses_memory.md`)
- No double counting between CC bill payment and individual CC charges
- For partial months: set `partial: true` and `data_through` in output
- **Description suffix rule:** When a mapped merchant's description is opaque, append a parenthetical suffix

### JSON Structure

Must match `BudgetData` interface from `src/lib/types.ts`. Key fields:
- `month`, `partial`, `data_through`, `currency`
- `income.total`, `income.items[]` — set `provisional: true` directly on the item (not inside `details`) for provisioned salary/income
- `expenses.by_category[].subcategories[].transactions[]` — set `provisional: true` on provisioned expense transactions
- `expenses.total`, `expenses.by_category`, `expenses.unclassified` (see above for provisional flag on transactions)
- `summary` (totals, net, investment, investment_pct, investment_desired)
- `budget_buckets` — exactly 3 buckets, no "Outros":
  - `custos_fixos`: Housing, Health, Insurance, Groceries, Transportation
  - `conforto`: Wellness, Subscriptions, Personal Care, Services, Food/Dining, Recreation, Shopping, Travel, Family Support (catch-all for any unlisted category)
  - `liberdade_financeira`: categories `["Investment (Troco Turbo)", "Net"]` — Investment (Troco Turbo) must match the exact key used in `expenses.by_category`
- `intentional_rdb_investments`
- `skipped[]`
- `notes[]`
