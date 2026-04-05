---
name: classify
description: Classify transactions (expenses and income) using the household's expenses_memory.md and income_inputs.md. Receives specific transactions to classify and returns type (expense/income), category, and subcategory for each. Use when the bot calls it or when the user asks to classify specific transactions.
---

# Classify Transactions

Receives one or more transactions and classifies each one as expense or income, with category and subcategory.

## Input

The prompt arrives already within a household context (resolved by the bot from the Telegram group/conversation). It contains:
- One or more transactions to classify, each with: `date`, `description`, `amount`, `account_name`, `holder`

## Reference Files

- `resources/{household}/expenses_memory.md` — Known Merchants table, Manual Overrides, category hierarchy, budget bucket mappings
- `resources/{household}/income_inputs.md` — Salary definitions, known income sources, date windows, frequencies

## Classification Process

For each transaction provided:

### 1. Determine type: expense or income
- Match against `income_inputs.md` salary rules (amount range + date window) and known income patterns
- If it matches an income pattern → `income`
- Otherwise → `expense`

### 2. Assign category and subcategory
- **Expenses:** match description against `expenses_memory.md` merchant patterns (case-insensitive, partial match). Manual Overrides take precedence over Known Merchants. Auto-classify unmatched by name heuristics (e.g. "Posto" → Transportation/Fuel, "Drogaria" → Health/Pharmacy)
- **Income:** match against `income_inputs.md` definitions and known patterns (salary, cashback, IOF adjustment, FGTS, named transfers)

### 3. Flag unknowns
- If no match is found, flag as **Uncategorized** so the user can review

## Special Handling

| Transaction Type | Treatment |
|---|---|
| Aplicacao RDB (small auto) | Investment / Troco Turbo |
| Aplicacao RDB (large, intentional) | Skip — not an expense |
| Estorno / refund | Allocate to original merchant's category as negative amount |
| Reimbursements (e.g. CARE PLUS) | Health / Reimbursement — net against health expenses |
| IOF de compra internacional | Income / Adjustment (IOF reimbursement) |
| Skip-flagged in expenses_memory.md | Excluded from totals |

## Memory Update

After classifying, update the relevant memory files with any newly discovered patterns:
- `expenses_memory.md` — add new merchants to Known Merchants table
- `income_inputs.md` — add new recurring income sources

## Output

For each input transaction, return:
- **type** — `expense` or `income`
- **category** — primary category (e.g. `Housing`, `Food/Dining`, `Income`)
- **subcategory** — specific subcategory (e.g. `Rent/Mortgage`, `Restaurant`, `Salary`)
