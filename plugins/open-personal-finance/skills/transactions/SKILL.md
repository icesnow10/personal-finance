---
name: transactions
description: List all rows from the flat monthly budget result.
---

# Transactions

## Data Sources

1. `resources/{household}/{YYYY-MM}/expenses/result/budget_*.json`
2. If the result file is missing, fall back to `transactions_pluggy_raw.json`

## Process

1. Read the flat month result.
2. Walk the top-level transaction array.
3. Display rows with date, description, amount, type, bucket, category, subcategory, holder, bank, and source.

## Notes

- The result file is already flat.
- Do not expect grouped categories or subcategories.
