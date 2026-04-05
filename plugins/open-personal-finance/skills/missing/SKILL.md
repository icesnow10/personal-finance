---
name: missing
description: List only transactions that are missing classifications (uncategorized). Use when the user asks about missing classifications, uncategorized transactions, or says "missing".
---

# Missing Classifications

Lists only transactions that have not been classified yet.

## Input

- Target month `YYYY-MM` (default: current month)
- Household name (from context or ask the user)

## Data Sources

1. **Raw transactions**: `resources/{household}/{YYYY-MM}/expenses/transactions_raw.json`
2. **Budget result**: `resources/{household}/{YYYY-MM}/expenses/result/budget_*.json`
3. **Expenses memory**: `resources/{household}/expenses_memory.md`

## Process

1. Read `transactions_raw.json` for the full transaction list
2. Read the budget JSON and collect all classified transactions from `expenses.by_category` (walk every category → subcategory → transactions)
3. Build a set of classified transaction keys (date + description + amount)
4. Filter raw transactions to only those NOT in the classified set and NOT in income items
5. Also include any transactions explicitly marked as "Uncategorized" in the budget result

## Output Format

Display as a markdown table sorted by date:

```
| Date | Description | Amount | Holder | Bank | Source |
|------|-------------|--------|--------|------|--------|
```

- At the end, show: `{count} uncategorized transactions out of {total} total`
- If zero missing: respond with "All transactions are classified for {YYYY-MM}."

## Suggested Actions

After listing, suggest:
- Use `/classify` to classify specific transactions
- Example: `/classify <description> as <category> <subcategory>`

## Notes

- Filter out transfers and investments from the missing list (these are expected to be unclassified)
- If no budget result exists, ALL non-transfer/non-investment transactions are "missing"
