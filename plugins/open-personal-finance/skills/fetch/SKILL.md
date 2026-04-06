---
name: fetch
description: Fetch bank and credit card transactions from Pluggy API for a target month and write the raw month file used by the pipeline.
---

# Fetch Transactions

Downloads Pluggy BANK + CREDIT transactions and saves them to:

`resources/{household}/{YYYY-MM}/expenses/transactions_pluggy_raw.json`

## Rules

- Run `/accounts` first so `pluggy_items.json` is current.
- Preserve Pluggy transaction `id` and `accountId`.
- Add household metadata like `_holder`, `_accountType`, `_accountName`, `_accountNumber`, and `_bank`.
- Deduplicate by Pluggy transaction `id`.
- `transactions_pluggy_raw.json` is the only month source file before compile.

## Output

The output of `/fetch` is only:
- `transactions_pluggy_raw.json`

That file is the direct input to `/compile`.
