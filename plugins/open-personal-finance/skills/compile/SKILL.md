---
name: compile
description: Generate a monthly budget report by running /fetch (Pluggy API), then orchestrating /recognize (income), /categorize (expenses), and /forecast (provisioning for partial months). Produces JSON output. Use when the user asks to generate, create, or analyze a monthly budget, expenses, or income.
---

# Compile Budget

Orchestrates the full monthly budget pipeline: fetch/read -> recognize income -> categorize expenses -> forecast (if partial) -> generate output.

## Household

The `{household}` is a short lowercase name (e.g. `household-1`, `michel`) that scopes all data. It is determined from context (the user's current household) or by asking. All paths below use `resources/{household}/` as root.

## Reference Files (in `resources/{household}/`)

| File | Purpose |
|---|---|
| `resources/{household}/expenses_memory.md` | Merchant-to-category mappings, manual overrides, known merchants, budget bucket definitions, RDB thresholds |
| `resources/{household}/income_memory.md` | Salary definitions (amounts, ranges, date windows), other known income sources |

## Pipeline

### 1. Fetch transactions — run /fetch

Run `/fetch` for the target month. This connects to Pluggy API (or falls back to CSVs), downloads all BANK + CREDIT transactions, and saves normalized data to `resources/{household}/{YYYY-MM}/expenses/transactions_raw.json`.

After `/fetch` completes, read `transactions_raw.json` and proceed.

### 2. Run /recognize

Apply income recognition rules from `income_memory.md` to identify:
- **Income items** (salary, cashback, transfers received, adjustments)
- **Skipped transfers** (internal movements, prior-month clearing, CC bill payments)

For partial months, `/recognize` provisions expected salary using definitions in `income_memory.md`.

### 3. Run /categorize

Apply expense classification using `expenses_memory.md` to all non-income, non-skipped transactions:
- **Categorized expenses** by category and subcategory
- **Skipped**: RDB/caixinha applications (Aplicação RDB) — these are internal transfers, not expenses or investments
- **Uncategorized** — flagged for user review

After classification, update `resources/{household}/expenses_memory.md` with any new merchant mappings.

### 4. Run /forecast (partial months only)

If `partial: true`, run `/forecast` which orchestrates `/recognize` (salary provisioning) + `/provision` (recurring expense estimates). Skip for complete months.

### 5. Compute summary

- `Total Income` = sum of all income items (including provisioned for partial months)
- `Total Expenses` = sum of all categorized + uncategorized (RDB applications are skipped, not in totals)
- `Net = Total Income - Total Expenses`
- `Liberdade Financeira = max(0, Net)` — this is what's available to invest, not what was invested

### 6. Compute budget buckets

Bucket definitions (target %, categories) are stored in `resources/{household}/expenses_memory.md`. Read them from there — do not hardcode.

### 7. Generate output

Write to `resources/{household}/{YYYY-MM}/expenses/result/`:
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
- Every transaction (income items, expense transactions, skipped, unclassified) must include `bank` and `account_number` fields from the normalized data
- `summary` (totals, net, investment, investment_pct, investment_desired)
- `budget_buckets` — exactly 3 buckets, no "Outros":
  - `custos_fixos`: Housing, Health, Insurance, Groceries, Transportation
  - `conforto`: Wellness, Subscriptions, Personal Care, Services, Food/Dining, Recreation, Shopping, Travel, Family Support (catch-all for any unlisted category)
  - `liberdade_financeira`: `["Net"]` — Net = receita − despesas. RDB/caixinha applications are skipped (internal transfers), not counted as investment or expense. Only explicit investments (ações, Tesouro, fundos) would be tracked here if they exist.
- `intentional_rdb_investments` — deprecated: RDB applications are now skipped. Keep field for backwards compatibility but set to empty/null.
- `skipped[]`
- `notes[]`
