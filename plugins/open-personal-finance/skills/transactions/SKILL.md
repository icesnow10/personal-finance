---
name: transactions
description: List all transactions for a month with their classifications. Shows date, description, amount, category, subcategory, holder, and source. Use when the user asks to list/show/view transactions, or says "transactions".
---

# Transactions

Lists all transactions for a target month with their classification status.

## Input

- Target month `YYYY-MM` (default: current month)
- Household name (from context or ask the user)

## Data Sources

1. **Raw transactions**: `resources/{household}/{YYYY-MM}/expenses/transactions_raw.json`
2. **Budget result**: `resources/{household}/{YYYY-MM}/expenses/result/budget_*.json` — contains classified transactions nested under `expenses.by_category`
3. **Expenses memory**: `resources/{household}/expenses_memory.md` — merchant-to-category mappings

## Process

1. Read `transactions_raw.json` for the full transaction list
2. Read the budget JSON to get classification data from `expenses.by_category`
3. Cross-reference each raw transaction with the classified data by matching date + description + amount
4. Build a unified list with: date, description, amount, category (or "Uncategorized"), subcategory, holder, bank, source

## Output Format

Display as a markdown table sorted by date:

```
| Date | Description | Amount | Category | Subcategory | Holder | Bank |
|------|-------------|--------|----------|-------------|--------|------|
```

- Positive amounts (income) should be marked with `+`
- Negative amounts (expenses) show as-is
- Uncategorized transactions should be marked with **Uncategorized**
- At the end, show summary: total transactions, classified count, uncategorized count

## Notes

- Filter out transfers and investments (category_name "Transfers" or "Investments" in raw data) unless the user explicitly asks for them
- If no budget result exists yet, show raw transactions with all categories as "Uncategorized"
- Respect the household context — only show data for the resolved household
