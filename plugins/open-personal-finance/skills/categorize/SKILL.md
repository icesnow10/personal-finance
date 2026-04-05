---
name: categorize
description: Classify expense transactions into categories using merchant patterns from expenses_memory.md. Handles refunds, special transactions, and flags uncategorized items. Use when /compile calls it or when the user asks to categorize/classify expenses.
---

# Categorize Expenses

Classifies expense transactions into categories using merchant-to-category mappings.

## Household

The `{household}` is a short lowercase name that scopes all data. Determined from context or by asking.

## Input

A normalized transaction list for the target month — from CSV files in `resources/{household}/{YYYY-MM}/expenses/input/` or from `transactions_raw.json`.

## Reference Files

- `resources/{household}/expenses_memory.md` — Known Merchants table, Manual Overrides, category hierarchy, budget bucket mappings

## Classification Process

1. **Read** `resources/expenses_memory.md` for all merchant-to-category mappings and overrides
2. **Match** each transaction description against merchant patterns (case-insensitive, partial match)
3. **Auto-classify** unmatched merchants by name heuristics (e.g. "Posto" -> fuel, "Drogaria" -> pharmacy)
4. **Flag** remaining as **Uncategorized** for user review

## Special Handling

| Transaction Type | Treatment |
|---|---|
| Aplicacao RDB (small auto) | Investment / Troco Turbo — include in expenses |
| Aplicacao RDB (large, intentional) | Intentional RDB — NOT in expense totals. Threshold defined in `expenses_memory.md` |
| Estorno / refund | Allocate to original merchant's category as negative amount |
| Reimbursements (e.g. health plan) | Net against the corresponding expense category |
| IOF de compra internacional | Classify as actual expense. **Never provision IOF** |

## Account-to-Holder-Bank Mapping

Determine `source`, `holder`, `bank`, and `account_number` from the account/CSV origin:
- Credit card CSVs (format: `date,title,amount`) -> source: "Credit Card", holder from filename prefix, bank from filename
- Savings account CSVs (format: `Data,Valor,Identificador,Descricao`) -> source: "Savings Account", holder from filename prefix, bank from filename
- For Pluggy data, `holder`, `bank`, and `account_number` are already set in `transactions_raw.json` — preserve them as-is
- For Visor data, map `account_name` to source/holder per patterns in `expenses_memory.md`

## Description Normalization

- CC CSVs: strip ` - Parcela` from installment descriptions (keep the fraction like `3/6`)
- Savings CSVs: simplify verbose PIX descriptions, keep recipient name with pipe separator
- When a merchant description is opaque, append a parenthetical suffix for clarity

## Memory Update

After classification, update `resources/{household}/expenses_memory.md`:
- Add new merchants to "Known Merchants" table
- Add manual overrides with reasoning in "Notes"
- Deduplicate — don't add merchants already mapped with same category

## Output

Returns categorized expenses (`by_category`), uncategorized list, investment entries, and intentional RDB entries for `/compile` to assemble. Each transaction preserves `bank` and `account_number` from the normalized input.
