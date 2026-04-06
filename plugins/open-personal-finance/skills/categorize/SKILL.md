---
name: categorize
description: Classify expense transactions into categories using merchant patterns from expenses_memory.md. Handles refunds, special transactions, and flags uncategorized items. Use when /compile calls it or when the user asks to categorize or classify expenses.
---

# Categorize Expenses

Classifies expense transactions into categories using merchant-to-category mappings.

## Household

The `{household}` is a short lowercase name that scopes all data.

## Input

A target month transaction list from `transactions_pluggy_raw.json` or equivalent explicit input files.

## Reference Files

- `resources/{household}/expenses_memory.md`

## Classification Process

1. Read merchant mappings and manual overrides.
2. Match each transaction description against known patterns.
3. Apply fallback heuristics for obvious merchants.
4. Leave anything still unknown in `unclassified`.

## Special Handling

| Transaction Type | Treatment |
|---|---|
| Aplicacao RDB (small auto) | Investment / Troco Turbo expense |
| Aplicacao RDB (large intentional) | Intentional RDB, not part of expense totals |
| Estorno / refund | Negative transaction in the original category |
| Reimbursements | Negative transaction in the corresponding category |
| IOF de compra internacional | Real expense, never provisional |

## Output

Return:
- a flat top-level JSON array of transaction rows
- expense rows with `bucket`, `category`, and `subcategory` filled in
- uncategorized rows left as `type: "unclassified"`
- intentional RDB entries kept as normal rows, not separate grouped sections

Do not emit totals, summaries, nested trees, bucket rollups, `transactions[]`, or any other wrapper structure. The output must stay as a top-level flat JSON array, and each transaction must preserve its stable `id`, `bank`, and `account_number`.
