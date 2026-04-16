---
name: fetch
description: Fetch bank and credit card transactions from Pluggy API for a target month and write the raw month files used by the pipeline.
---

# Fetch Transactions

Downloads Pluggy BANK + CREDIT transactions and saves them as separate raw files:

```
resources/{household}/{YYYY-MM}/expenses/
  cc_open_bill.json       ← credit card transactions with status PENDING (current open bill)
  cc_closed_bill.json     ← credit card transactions with status POSTED (closed/paid bills)
  savings.json            ← savings/checking account (BANK type) transactions
```

## Rules

- Run `/accounts` first so `pluggy_items.json` is current.
- Preserve Pluggy transaction `id` and `accountId`.
- For installment transactions, preserve `totalInstallments` and `installmentNumber` from the Pluggy response. These fields come from `creditCardMetadata` in the API. If the transaction is not an installment, omit these fields.
- Add household metadata like `_holder`, `_accountType`, `_accountName`, `_accountNumber`, and `_bank`.
- **`_accountNumber` must come from `pluggy_items.json`**, not from the transaction payload. Look up the transaction's `accountId` in `pluggy_items.json` to find the matching account entry and use its `number` field. Never use `creditCardMetadata.cardNumber` as the account number — that field contains the last 4 digits of the physical/virtual card, which varies across cards on the same account.
- Deduplicate by Pluggy transaction `id` within each file.

## Splitting logic

After fetching all transactions for the month:

1. **`cc_open_bill.json`** — all transactions where `_accountType` is `CREDIT` and `status` is `PENDING`.
2. **`cc_closed_bill.json`** — all transactions where `_accountType` is `CREDIT` and `status` is `POSTED`.
3. **`savings.json`** — all transactions where `_accountType` is `BANK`.

Each file is a top-level JSON array. If a category has zero transactions, write an empty array `[]`.

## Output

The output of `/fetch` is:
- `cc_open_bill.json`
- `cc_closed_bill.json`
- `savings.json`

After writing the files, run `/audit` on all three. Audit auto-fixes issues and retries up to 3 times. Only stop if auto-fix exhausts all attempts.

These files are the direct input to `/compile`.
