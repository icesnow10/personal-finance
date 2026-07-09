---
name: audit
description: Validate the schema of a monthly budget, auto-fixing where possible. Checks required fields, types, buckets, FX, enrichment and installment rules. Use when /fetch, /recompile, or /heartbeat call it, or when the user asks to audit, validate, or check a month's data integrity.
---

# Audit

Run the bundled script:

```
node plugins/open-personal-finance/scripts/audit.mjs --household {household} --month {YYYY-MM}
```

Validates `budget_*.json` against [SCHEMA.md](../../SCHEMA.md) and auto-fixes, retrying up
to 3 times. Exits 0 when clean, non-zero if issues remain after 3 attempts.

## Checks

- Valid `type` and `bucket`; expense rows have non-null bucket + category + subcategory.
- Numeric `amount`; `YYYY-MM-DD` `date` on non-provisional rows; no duplicate ids.
- `account_number` exists in `pluggy_items.json`.
- Foreign-currency rows use `amountInAccountCurrency` (BRL), not the native amount.
- Opaque transfer descriptions carry a `(Category - Subcategory)` suffix.
- Each `(category, subcategory)` pair uses exactly one bucket.
- No mojibake in `description` — no double-encoded UTF-8 (e.g. `TransferÃªncia`).
- **Installment continuity** — every plan (`k/N`, `N ≥ 2`) that ran in either of the last two
  months has its `k+1/N` successor present this month; a missing one is provisioned (see below).

## Auto-fixes

Description enrichment, FX correction, bucket consistency, and mojibake are fixed
automatically and logged.

**Installment provisioning.** A charge split into `N` parts posts one installment per month. The
audit scans the **last two months' budgets** (`resources/{household}/{prevMonth}/…`) and, for each
plan that carried installment `k/N` there (`k < N`), checks that this month has `k+1/N`. If it
lagged out (hasn't posted yet), a `provisional: true` expense is added — copying the source plan's
amount/holder/bank/account/category/subcategory/bucket, with the successor description derived by
swapping the installment number in the source text (using the structured `installmentNumber` — not
a text guess). Key points:

- **Installment numbers come from the structured fields, never re-parsed from text.** A plan is
  keyed by `merchant | holder | account | totalInstallments | round(amount)`. `installmentNumber` /
  `totalInstallments` are read straight off the row; the description is used only to isolate the
  merchant, by removing the exact known `k/N` token (not a regex guess). Merchant **and** amount are
  both needed: the amount separates two concurrent *same-merchant* plans (the two `PG *DOREL` 10x at
  R$475.86 vs R$125.93), and the merchant separates two *same-amount* plans (`Drogarias Pacheco` vs
  `Drogaria Ven*Loja`, both ~R$108.9 over 3x). Rounding the amount keeps one plan together despite
  cents rounding between installments (e.g. Labs A+ 42.32 → 42.31).
- **Two-month lookback** so a plan that briefly dropped out of the immediately-previous month is
  still projected.
- Advances **one step per plan per month** (keyed off the highest installment seen for that plan,
  real or provisional), is **idempotent**, and is **skipped for `--final`** (a closed month is
  stripped of provisionals by `/settle`).
- Stable id `manual:prov:inst:<merchant>:<holder>:<account>:<N>:<round(amount)>:<k+1>`. When the
  real `k+1/N` later posts, `/recompile` reconciles the provisional away by `category|subcategory`. Mojibake is repaired by re-deriving the clean `description` from the
matching raw transaction by `id` (the source of truth is always clean UTF-8), falling back to
reversing the double-encode in place when there is no raw twin. If the script still fails after
3 attempts, read the printed issues and resolve them by hand. Do not proceed downstream until
audit is clean.

> Always read/write these JSONs as UTF-8. Never bulk-edit `budget_*.json` with PowerShell
> `Get-Content | Set-Content` (PS 5.1 reads UTF-8 as cp1252) or Python `open(..., 'w')` without
> `encoding='utf-8'` — that is what introduces mojibake in the first place. Prefer re-running
> `/recompile`, which rebuilds descriptions from the clean raw.
