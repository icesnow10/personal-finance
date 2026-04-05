---
name: classify
description: Classify specific transactions (expenses or income) using the household's expenses_memory.md and income_memory.md. Receives 1 or more transactions via reply or inline. Updates memory files with new patterns. Use when the user asks to classify specific transactions — NOT for whole-month batch (that's /categorize).
---

# Classify Transactions

Classifies **specific** transactions (1 or more) — not a whole month. For whole-month batch classification, use `/categorize`.

## Input

The user provides specific transactions to classify, typically by replying to a bot message that contains them, along with classification instructions (e.g. `/classify lucas andrade as services designer`).

- The replied-to message text — contains the transaction(s) to classify
- The user's instructions — may specify category, subcategory, type, or other hints

## Process

1. Parse transactions from the replied message or inline input
2. Apply the user's instructions for classification
3. Match against `expenses_memory.md` and `income_memory.md` for context
4. Update `expenses_memory.md` with the new pattern so future occurrences are auto-classified

## Output

- Confirmation of the classification applied
- For each transaction: **type** (expense/income), **category**, **subcategory**, **bank**

## Reference Files

- `resources/{household}/expenses_memory.md` — Known Merchants table, Manual Overrides, category hierarchy, budget bucket mappings
- `resources/{household}/income_memory.md` — Salary definitions, known income sources, date windows, frequencies

## Classification Logic

For each transaction:

### 1. Determine type: expense or income
- Match against `income_memory.md` salary rules (amount range + date window) and known income patterns
- If it matches an income pattern → `income`
- Otherwise → `expense`

### 2. Assign category and subcategory
- **Expenses:** match description against `expenses_memory.md` merchant patterns (case-insensitive, partial match). Manual Overrides take precedence over Known Merchants. Auto-classify unmatched by name heuristics (e.g. "Posto" → Transportation/Fuel, "Drogaria" → Health/Pharmacy)
- **Income:** match against `income_memory.md` definitions and known patterns (salary, cashback, IOF adjustment, FGTS, named transfers)

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
- `income_memory.md` — add new recurring income sources
