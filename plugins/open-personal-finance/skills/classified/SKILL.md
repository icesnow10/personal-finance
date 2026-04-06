---
name: classified
description: List classified expense rows from the flat monthly budget result.
---

# Classified Transactions

## Process

1. Read `resources/{household}/{YYYY-MM}/expenses/result/budget_*.json`.
2. Filter the top-level transaction array to rows where:
   - `type` is `expense`
   - `category` is non-null
   - `subcategory` is non-null
3. Present the rows sorted by category, subcategory, then date.

## Notes

- The source is flat.
- Do not walk nested category trees.
