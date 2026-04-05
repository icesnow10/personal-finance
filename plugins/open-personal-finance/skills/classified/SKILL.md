---
name: classified
description: List only classified transactions grouped by category. Use when the user asks to see classified transactions, category breakdown, or says "classified".
---

# Classified Transactions

Lists only transactions that have been classified, grouped by category.

## Input

- Target month `YYYY-MM` (default: current month)
- Household name (from context or ask the user)

## Data Sources

1. **Budget result**: `resources/{household}/{YYYY-MM}/expenses/result/budget_*.json` — the authoritative source for classifications

## Process

1. Read the budget JSON
2. Walk `expenses.by_category` → each category → each subcategory → transactions
3. Collect all classified transactions with their category and subcategory

## Output Format

Display grouped by category, then subcategory:

```
### Category Name (R$ total)

| Date | Description | Amount | Subcategory | Holder | Bank |
|------|-------------|--------|-------------|--------|------|

```

- Sort categories by total amount (highest first)
- Within each category, sort transactions by date
- At the end, show summary: total classified amount, number of categories, number of transactions

## Notes

- If no budget result exists, respond with "No budget compiled yet for {YYYY-MM}. Run /compile first."
- Include the budget bucket each category belongs to (Custos Fixos / Conforto / Liberdade Financeira) from `expenses_memory.md`
