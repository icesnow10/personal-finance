---
name: compile
description: Generate a monthly categorized transaction JSON by running /fetch, then orchestrating /recognize, /categorize, and /forecast for partial months. Use when the user asks to generate, create, or analyze a monthly budget, expenses, or income.
---

# Compile Budget

Orchestrates the full monthly budget pipeline: fetch/read -> recognize income -> categorize expenses -> forecast (if partial) -> generate output.

## Household

The `{household}` is a short lowercase name (for example `household-1`) that scopes all data. All paths below use `resources/{household}/` as root.

## Reference Files

| File | Purpose |
|---|---|
| `resources/{household}/expenses_memory.md` | Merchant mappings, manual overrides, category hierarchy, bucket definitions, RDB thresholds |
| `resources/{household}/income_memory.md` | Salary definitions, amount ranges, date windows, and known income sources |

## Pipeline

### 1. Fetch transactions

Run `/fetch` for the target month. It downloads BANK + CREDIT transactions and saves them as three separate raw files:
- `resources/{household}/{YYYY-MM}/expenses/cc_open_bill.json` — CC pending (open bill)
- `resources/{household}/{YYYY-MM}/expenses/cc_closed_bill.json` — CC posted (closed bill)
- `resources/{household}/{YYYY-MM}/expenses/savings.json` — savings/checking account

Combine all three files into a single transaction list for the pipeline steps below.

### 2. Run /recognize

Use `income_memory.md` to identify:
- income items
- skipped transfers

For partial months, provision expected salary when the rules indicate it.

### 3. Run /categorize

Apply `expenses_memory.md` to all non-income, non-skipped transactions:
- categorize expenses by category and subcategory
- skip internal RDB or caixinha movements
- flag uncategorized transactions for review

After classification, update `resources/{household}/expenses_memory.md` with any new merchant mappings.

### 4. Run /forecast

If `partial: true`, run `/forecast` to add provisional income and recurring expenses. Skip this step for complete months.

### 5. Generate output

Write to `resources/{household}/{YYYY-MM}/expenses/result/`:
- `budget_{month}_{year}.json`

### 6. User review

Present uncategorized transactions for user review. After review, update the output and `expenses_memory.md`.

### 7. Optional notifications

After the JSON is generated, run `/advise` to produce the formatted budget message. `/advise` already calls `/notify` internally — do NOT call `/notify` again from compile.

## Output Rules

- All dates must use `YYYY-MM-DD`.
- Refunds stay in their original category as negative transactions.
- Intentional large RDB entries may remain in `intentional_rdb_investments`, but they are not expense totals.
- Do not double count credit card bill payments with the card charges themselves.
- Partial months must set `partial: true` and include `data_through`.
- If a merchant description is opaque, append a clarifying suffix in parentheses.
- The JSON must contain raw month data only.
- Do not include computed summary fields such as `summary`, `budget_buckets`, root `buckets`, `net`, or `liberdade_financeira_pct`.
- Do not emit nested category trees or any wrapper object in the final file. The canonical output is a top-level flat JSON array of transaction rows.

## JSON Shape

Return a top-level JSON array. Do not wrap it in an object with `transactions`, `month`, `notes`, or any other top-level keys.

Transaction requirements:
- every transaction must include:
  - `id`
  - `type` as `income`, `expense`, `skipped`, or `unclassified`
  - `date` — **mandatory** for real transactions, **optional** for provisioned ones (`provisional: true`)
  - `description`
  - `amount`
  - `holder`
  - `bank`
  - `account_number`
  - `source`
- expense rows must also include `bucket`, `category`, and `subcategory`
- income, skipped, and uncategorized rows may leave `bucket`, `category`, and `subcategory` as `null`
- provisioned income or expense items must set `provisional: true` directly on the row
- installment transactions must carry `totalInstallments` and `installmentNumber` from the raw file when present

Minimal example:

```json
[
  {
    "id": "pluggy:123",
    "type": "expense",
    "date": "2026-04-05",
    "description": "Conta Vivo",
    "amount": 296,
    "holder": "holder1",
    "bank": "Nubank",
    "account_number": "6072",
    "source": "Credit Card",
    "bucket": "custos_fixos",
    "category": "Housing",
    "subcategory": "Internet/Phone",
    "provisional": false
  },
  {
    "id": "manual:unclassified:1",
    "type": "unclassified",
    "date": "2026-04-05",
    "description": "Compra desconhecida",
    "amount": 42.9,
    "holder": "holder1",
    "bank": "Nubank",
    "account_number": "6072",
    "source": "Credit Card",
    "bucket": null,
    "category": null,
    "subcategory": null,
    "provisional": false
  }
]
```
