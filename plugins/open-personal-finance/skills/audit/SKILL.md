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
- **Installment continuity** — every plan (`k/N`, `N ≥ 2`) that ran in the previous month has
  its `k+1/N` successor present this month; a missing one is provisioned (see below).

## Auto-fixes

Description enrichment, FX correction, bucket consistency, and mojibake are fixed
automatically and logged.

**Installment provisioning.** A charge split into `N` parts posts one installment per month.
The audit reads the previous month's budget (`resources/{household}/{prevMonth}/…`) and, for
each plan that carried installment `k/N` there (`k < N`), checks that this month has `k+1/N`. If
it lagged out (hasn't posted yet), a `provisional: true` expense is added — description
`"<base> k+1/N - provisioned"`, stable id `manual:prov:inst:<base>:<N>:<k+1>:<holder>`, copying
the source plan's amount/holder/bank/account/category/subcategory/bucket. It advances **one step
per plan per month** (keyed off the highest installment seen in the prior month, real or
provisional), is **idempotent**, and is **skipped for `--final`** (a closed month is stripped of
provisionals by `/settle`). When the real `k+1/N` later posts, `/recompile` reconciles it away by
`category|subcategory` like any other provisional. Mojibake is repaired by re-deriving the clean `description` from the
matching raw transaction by `id` (the source of truth is always clean UTF-8), falling back to
reversing the double-encode in place when there is no raw twin. If the script still fails after
3 attempts, read the printed issues and resolve them by hand. Do not proceed downstream until
audit is clean.

> Always read/write these JSONs as UTF-8. Never bulk-edit `budget_*.json` with PowerShell
> `Get-Content | Set-Content` (PS 5.1 reads UTF-8 as cp1252) or Python `open(..., 'w')` without
> `encoding='utf-8'` — that is what introduces mojibake in the first place. Prefer re-running
> `/recompile`, which rebuilds descriptions from the clean raw.
