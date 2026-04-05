---
name: classify
description: Classify transactions (expenses and income) using the household's expenses_memory.md and income_inputs.md. Can receive transactions inline or read from a month's transactions_raw.json. Updates memory files with new patterns. Use when the bot calls it after fetching or when the user asks to classify transactions.
---

# Classify Transactions

Classifies both expense and income transactions using the household's memory files.

## Input

Transactions can come from:
1. **Inline** — a list of transactions passed directly in the prompt
2. **From file** — read from `transactions_raw.json` for a specific month when `year_month` is provided

Each transaction has: `date`, `description`, `amount`, `category_name`, `account_name`, `holder`.

## Reference Files

- `expenses_memory.md` — Known Merchants table, Manual Overrides, category hierarchy, budget bucket mappings
- `income_inputs.md` — Salary definitions, known income sources, date windows, frequencies

## Classification Process

### Expenses
1. **Read** `expenses_memory.md` for all merchant-to-category mappings and overrides
2. **Match** each transaction description against merchant patterns (case-insensitive, partial match)
3. **Apply overrides** — Manual Overrides take precedence over Known Merchants
4. **Auto-classify** unmatched merchants by name heuristics (e.g. "Posto" → fuel, "Drogaria" → pharmacy)
5. **Flag** remaining as **Uncategorized** for user review

### Income
1. **Read** `income_inputs.md` for salary definitions (amount ranges, date windows, frequency)
2. **Match** positive transactions from BANK accounts against salary rules (amount within range + date within window)
3. **Identify** other known income: cashback, IOF adjustments/refunds, named transfers, FGTS
4. **Flag** unrecognized positive transactions for user review
5. **Update** `income_inputs.md` with any new recurring income patterns discovered

## Special Handling

| Transaction Type | Treatment |
|---|---|
| Aplicacao RDB (small auto) | Investment / Troco Turbo — include in expenses |
| Aplicacao RDB (large, intentional) | Intentional RDB — NOT in expense totals. Threshold defined in `expenses_memory.md` |
| Estorno / refund | Allocate to original merchant's category as negative amount |
| Reimbursements (e.g. health plan) | Net against the corresponding expense category |
| IOF de compra internacional | Classify as actual expense. **Never provision IOF** |
| Skip-flagged transactions | Transactions marked as "Skip" in expenses_memory.md are excluded from totals |

## Holder Mapping

The `holder` field is already set in each transaction from the Pluggy fetch. Use the "Holder Corrections" table in expenses_memory.md for any overrides.

## Description Normalization

- Strip ` - Parcela` from installment descriptions (keep the fraction like `3/6`)
- Simplify verbose PIX descriptions, keep recipient name
- When a merchant description is opaque, append a parenthetical suffix for clarity

## Memory Update

After classification, update the relevant memory files:

### expenses_memory.md
- Add newly discovered merchants to the "Known Merchants" table
- Add manual overrides with reasoning in "Notes" column
- Deduplicate — don't add merchants already mapped with same category

### income_inputs.md
- Add newly discovered recurring income sources (new employer, recurring transfers)
- Update amount ranges if salary changed
- Add new "Other Known Income" entries with frequency and notes

## Output

1. **Enrich transactions in-place** with: `category`, `subcategory`, `bucket`, `skip`, `income_type` (for income) — if reading from file, write back to `transactions_raw.json`
2. **Update `expenses_memory.md`** — add newly discovered merchants
3. **Update `income_inputs.md`** — add newly discovered income patterns
4. **Return a summary** with:
   - Total transactions classified (expenses + income)
   - Count per category
   - Total income recognized
   - Uncategorized items (list descriptions for user review)
   - New patterns added to memory files
