---
name: classify
description: Classify expense transactions using merchant patterns from the household's expenses_memory.md. Can receive transactions inline or read from a month's transactions_raw.json. Updates the memory file with new merchants. Use when the bot calls it after fetching or when the user asks to classify expenses.
---

# Classify Transactions

Classifies expense transactions using merchant-to-category mappings from the household's expenses_memory.md.

## Input

Transactions can come from:
1. **Inline** — a list of transactions passed directly in the prompt
2. **From file** — read from `transactions_raw.json` for a specific month when `year_month` is provided

Each transaction has: `date`, `description`, `amount`, `category_name`, `account_name`, `holder`.

## Reference Files

- `expenses_memory.md` in the household folder — Known Merchants table, Manual Overrides, category hierarchy, budget bucket mappings

## Classification Process

1. **Read** `expenses_memory.md` for all merchant-to-category mappings and overrides
2. **Match** each transaction description against merchant patterns (case-insensitive, partial match)
3. **Apply overrides** — Manual Overrides take precedence over Known Merchants
4. **Auto-classify** unmatched merchants by name heuristics (e.g. "Posto" → fuel, "Drogaria" → pharmacy)
5. **Flag** remaining as **Uncategorized** for user review

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

After classification, update `expenses_memory.md`:
- Add newly discovered merchants to the "Known Merchants" table
- Add manual overrides with reasoning in "Notes" column
- Deduplicate — don't add merchants already mapped with same category

## Output

1. **Enrich transactions in-place** with: `category`, `subcategory`, `bucket`, `skip` — if reading from file, write back to `transactions_raw.json`
2. **Update `expenses_memory.md`** — add newly discovered merchants to Known Merchants table
3. **Return a summary** with:
   - Total transactions classified
   - Count per category
   - Uncategorized items (list descriptions for user review)
   - New merchants added to memory
