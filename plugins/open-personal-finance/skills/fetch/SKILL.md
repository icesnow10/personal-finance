---
name: fetch
description: Fetch bank and credit card transactions from Pluggy API for a target month and write the raw month files used by the pipeline.
---

# Fetch Transactions

Downloads Pluggy BANK + CREDIT transactions and saves them as raw files:

```
resources/{household}/{YYYY-MM}/expenses/
  transactions_raw.json   ← ALL transactions from Pluggy (unsplit, full payload + household metadata)
  cc_open_bill.json       ← credit card transactions with status PENDING (current open bill)
  cc_closed_bill.json     ← credit card transactions with status POSTED (closed/paid bills)
  savings.json            ← savings/checking account (BANK type) transactions
```

## Rules

- Run `/accounts` first so `pluggy_items.json` is current.
- **Preserve the entire Pluggy API response for each transaction.** Do not drop or transform any fields from the original payload. The only rename allowed is `creditCardMetadata` → `metadata` (so the field name is generic and works for both CC and savings transactions). All other fields (`id`, `description`, `descriptionRaw`, `currencyCode`, `amount`, `amountInAccountCurrency`, `date`, `category`, `categoryId`, `balance`, `accountId`, `providerCode`, `status`, `paymentData`, `type`, `operationType`, `acquirerData`, `merchant`, `providerId`, `order`, `createdAt`, `updatedAt`, etc.) must be kept as-is. The raw files must contain the full Pluggy response so downstream skills can access any field they need.
- **Append** (do not replace) household metadata fields prefixed with `_`: `_holder`, `_accountType`, `_accountName`, `_accountNumber`, and `_bank`. These are the only fields added by fetch.
- **`_accountNumber` must come from `pluggy_items.json`**, not from the transaction payload. Look up the transaction's `accountId` in `pluggy_items.json` to find the matching account entry and use its `number` field. Never use `metadata.cardNumber` as the account number — that field contains the last 4 digits of the physical/virtual card, which varies across cards on the same account.
- Deduplicate by Pluggy transaction `id` within each file.

## Raw log

Before splitting, write **all** fetched transactions (with household metadata already appended) to `transactions_raw.json`. This is the single source of truth — the complete Pluggy API response for the month, deduplicated by `id`. The split files below are derived from this file.

## Splitting logic

After writing `transactions_raw.json`, split into three files:

1. **`cc_open_bill.json`** — all transactions where `_accountType` is `CREDIT` and `status` is `PENDING`.
2. **`cc_closed_bill.json`** — all transactions where `_accountType` is `CREDIT` and `status` is `POSTED`.
3. **`savings.json`** — all transactions where `_accountType` is `BANK`.

Each file is a top-level JSON array. If a category has zero transactions, write an empty array `[]`.

## Output

The output of `/fetch` is:
- `transactions_raw.json` (all transactions, unsplit)
- `cc_open_bill.json`
- `cc_closed_bill.json`
- `savings.json`

After writing the files, run `/audit` on the three split files. Audit auto-fixes issues and retries up to 3 times. Only stop if auto-fix exhausts all attempts.

These files are the direct input to `/compile`.
