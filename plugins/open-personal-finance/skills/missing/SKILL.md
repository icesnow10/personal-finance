---
name: missing
description: List rows still marked as unclassified.
---

# Missing Classifications

## Process

1. Read `resources/{household}/{YYYY-MM}/expenses/result/budget_*.json`.
2. Filter the top-level transaction array to rows where `type` is `unclassified`.
3. If the result file is missing, inspect `transactions_pluggy_raw.json` and treat non-transfer, non-investment rows as missing.

## Notes

- The final month file is flat.
- Do not compare against nested grouped output.
