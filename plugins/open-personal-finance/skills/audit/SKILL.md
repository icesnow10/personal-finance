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

## Auto-fixes

Description enrichment, FX correction, bucket consistency, and mojibake are fixed
automatically and logged. Mojibake is repaired by re-deriving the clean `description` from the
matching raw transaction by `id` (the source of truth is always clean UTF-8), falling back to
reversing the double-encode in place when there is no raw twin. If the script still fails after
3 attempts, read the printed issues and resolve them by hand. Do not proceed downstream until
audit is clean.

> Always read/write these JSONs as UTF-8. Never bulk-edit `budget_*.json` with PowerShell
> `Get-Content | Set-Content` (PS 5.1 reads UTF-8 as cp1252) or Python `open(..., 'w')` without
> `encoding='utf-8'` — that is what introduces mojibake in the first place. Prefer re-running
> `/recompile`, which rebuilds descriptions from the clean raw.
