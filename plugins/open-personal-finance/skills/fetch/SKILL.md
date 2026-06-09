---
name: fetch
description: Fetch bank and credit card transactions from Pluggy API for a target month and write the raw month files used by the pipeline.
---

# Fetch Transactions

Run the bundled script (no per-month code):

```
node plugins/open-personal-finance/scripts/fetch.mjs --household {household} --month {YYYY-MM}
```

It authenticates with Pluggy (credentials from `{household}/.env.local`), pulls every
non-manual account in `pluggy_items.json` for the month window, **preserves the full
Pluggy payload** (only rename `creditCardMetadata` → `metadata`), appends household
metadata (`_holder`, `_accountType`, `_accountName`, `_accountNumber` from
`pluggy_items.json`, `_bank`), dedupes by `id`, and writes:

```
{household}/{YYYY-MM}/expenses/
  transactions_raw.json   ← all transactions (source of truth)
  cc_open_bill.json       ← CREDIT + status PENDING
  cc_closed_bill.json     ← CREDIT + status POSTED
  savings.json            ← BANK
```

## Notes

- Run `/accounts` first if `pluggy_items.json` is stale.
- A fresh month's first fetch can be incomplete (Pluggy still syncing) — if a new month
  returns suspiciously few card rows, run it again.
- Then run `/audit` on the split files, or proceed to `/recompile`.
