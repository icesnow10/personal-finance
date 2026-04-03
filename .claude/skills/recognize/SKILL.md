---
name: recognize
description: Identify and classify income transactions from savings account data. Matches salary by amount+date rules, handles prior-month clearing, and provisions expected salary for partial months. Use when /compile calls it or when the user asks to recognize/classify income.
---

# Recognize Income

Identifies income transactions from a list of savings account movements using rules defined in reference files.

## Input

A normalized transaction list for the target month, already split into savings account vs credit card.

## Reference Files

- `resources/income_inputs.md` — Salary definitions (label, expected amount, range, date window, frequency), other known income sources
- `resources/expenses_memory.md` — Named transfer mappings (to distinguish income from family support, etc.)

## Salary Recognition

### Matching Logic

1. Read salary definitions from `resources/income_inputs.md`
2. Scan all unnamed incoming transfers on savings account for the target month
3. For each salary definition, find transfers within the amount range AND date window
4. Match **once per definition per month** — if multiple candidates, pick closest to expected amount
5. Mark matched transactions with a descriptive label

### Provisioning for Partial Months

When the month is partial and salary hasn't arrived yet:
- **Provision expected salary** for each definition using the expected amount from `income_inputs.md`
- Mark with `"provisional": true`
- When month is complete (data through last day), only use actual observed transactions

## Other Income Classification

Classify by matching description patterns. Common patterns (read actual mappings from reference files):
- Cashback withdrawals
- IOF adjustments/reversals
- Investment yields
- Named transfers (check `expenses_memory.md` to distinguish income vs family support)
- Irregular income (PLR, FGTS, etc. — timing rules in `income_inputs.md`)

## Skip Rules

Skip these to avoid double counting:
- Transfers between the holder's own accounts (same person, just moving money)
- Transfers between household members (e.g. Michel → Carol) — internal movements
- RDB withdrawals (Resgate RDB) — internal movements
- Fund withdrawals (Resgate Fundo) — internal movements
- CC bill payments (Pagamento de fatura) — individual CC charges already counted

**Cash-basis principle:** all income and expenses are accounted in the month the transaction posts. Never skip a transaction because it "belongs to" a prior month.

## Output

Returns classified income items and skipped transfers for `/compile` to assemble into the final report.
