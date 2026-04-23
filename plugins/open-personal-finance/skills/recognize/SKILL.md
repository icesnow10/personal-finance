---
name: recognize
description: Identify and classify income transactions from savings account data. Matches salary by amount+date rules, handles prior-month clearing, and provisions expected salary for partial months. Use when /compile calls it or when the user asks to recognize/classify income.
---

# Recognize Income

Identifies income transactions from a list of savings account movements using rules defined in reference files.

## Household

The `{household}` is a short lowercase name that scopes all data. Determined from context or by asking.

## Input

A normalized transaction list for the target month, already split into savings account vs credit card.

## Reference Files

- `resources/{household}/income_memory.md` — Salary definitions (label, expected amount, range, date window, frequency), other known income sources
- `resources/{household}/expenses_memory.md` — Named transfer mappings (to distinguish income from family support, etc.)

## Salary Recognition

### Matching Logic

1. Read salary definitions from `resources/{household}/income_memory.md`
2. Scan all unnamed incoming transfers on savings account for the target month
3. For each salary definition, find transfers within the amount range AND date window
4. Match **once per definition per month** — if multiple candidates, pick closest to expected amount
5. Mark matched transactions with a descriptive label

### Provisioning for Partial Months

When the month is partial and salary hasn't arrived yet:
- **Provision expected salary** for each definition using the expected amount from `income_memory.md`
- Mark with `"provisional": true`
- When month is complete (data through last day), only use actual observed transactions

## Other Income Classification

Classify by matching description patterns. Common patterns (read actual mappings from reference files):
- Cashback withdrawals
- IOF adjustments/reversals
- Investment yields
- Named transfers (check `expenses_memory.md` to distinguish income vs family support)
- Irregular income (PLR, FGTS, etc. — timing rules in `income_memory.md`)

## Skip Rules

Skip these to avoid double counting:
- Transfers between the holder's own accounts (same person, just moving money)
- Transfers between household members (e.g. holder1 → holder2) — internal movements
- RDB withdrawals (Resgate RDB) — internal movements
- Fund withdrawals (Resgate Fundo) — internal movements
- CC bill payments (Pagamento de fatura) — individual CC charges already counted

**Cash-basis principle:** all income and expenses are accounted in the month the transaction posts. Never skip a transaction because it "belongs to" a prior month.

## Reconciliation with Provisioned Income

Provisional salary rows (`"provisional": true`, e.g. id `manual-income:michel-salary-prov`) represent income expected but not yet observed. When the real salary deposit lands, it must not double-count with the provision.

### Matching rule

A real income row matches a provisional salary row when:
- Both have the same `holder`.
- Real row's classification is `Income / Salary` (or whatever the provision's `subcategory` was) as defined in `income_memory.md`.
- Real row's `amount` falls within the salary definition's expected range.

### Adjustment

For each real salary match:

1. **Decrement** the provisional's `amount` by the real row's `amount`.
2. If the result is **≤ 0.01**, **remove** the provisional row entirely (fully settled).
3. If the result is still positive (partial advance, bonus split, etc.), keep the provisional with the reduced amount (still marked `provisional: true`) so the remaining expected deposit is still reflected in the monthly forecast.
4. If the real amount **exceeds** the provisional (e.g. salary came in higher than expected), remove the provisional entirely — never flip the sign.
5. One real salary row consumes at most one provisional per holder.

Apply reconciliation after matching all real salary candidates for the month, so the largest/closest observed deposit wins first.

Log each adjustment (provisional id, old amount, new amount, consumed by real id).

## Output

Returns classified income items and skipped transfers for `/compile` to assemble into the final report. Each income item and skipped transfer preserves `bank` and `account_number` from the normalized input. Provisioned salary items should use the `bank` from the salary definition in `income_memory.md` (if available) or `null`.

After classification, run `/learn` to persist any newly discovered income or skip patterns to memory files.
