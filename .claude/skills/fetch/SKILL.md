---
name: fetch
description: Fetch bank and credit card transactions from Pluggy API for a target month. Authenticates, pulls all accounts (BANK + CREDIT), normalizes, and saves raw + normalized JSON files. Use when /compile calls it, or when the user asks to fetch/pull/sync bank data.
---

# Fetch Transactions from Pluggy

Connects to the Pluggy open-finance API to download transactions for a target month and saves them to `resources/{YYYY-MM}/expenses/`.

## Credentials

Read from `.env.local` at the project root:

```
PLUGGY_CLIENT_ID=...
PLUGGY_CLIENT_SECRET=...
PLUGGY_ITEM_IDS=id1,id2   # comma-separated, one per bank connection
```

## Holder Mapping

`resources/pluggy_items.json` maps Pluggy item UUIDs to household members:

```jsonc
{
  "items": {
    "<item-id>": {
      "holder": "michel",
      "accounts": { "<account-id>": { "type": "BANK", ... } }
    }
  }
}
```

- **First run** (file missing or item ID unknown): list accounts for each item, show the user account names/numbers, ask which holder each belongs to, and save the mapping.
- **Subsequent runs**: read the file and resolve holders automatically.

## Fetch Flow

Use `node -e` (not `jq` — unavailable on Windows). Source credentials via `source .env.local` before the node inline script.

### 1. Authenticate

```
POST https://api.pluggy.ai/auth
Body: { "clientId": "...", "clientSecret": "..." }
→ { "apiKey": "..." }   // valid ~2 hours
```

### 2. List accounts for each item

```
GET https://api.pluggy.ai/accounts?itemId={itemId}
Header: X-API-KEY: {apiKey}
→ { "results": [{ "id", "type" (BANK|CREDIT), "subtype", "name", "number" }] }
```

### 3. Fetch BANK transactions

```
GET https://api.pluggy.ai/transactions?accountId={id}&from={YYYY-MM-DD}&to={YYYY-MM-DD}&pageSize=500
Header: X-API-KEY: {apiKey}
```

- `from` = first day of target month, `to` = last day
- Paginate with `&page=N` if `totalPages > 1`

### 4. Fetch CREDIT transactions

Same endpoint as BANK — use `from`/`to` date range (the `/bills` endpoint may return empty):

```
GET https://api.pluggy.ai/transactions?accountId={ccId}&from={YYYY-MM-DD}&to={YYYY-MM-DD}&pageSize=500
```

Returns CC charges posted in the date range (including installments from prior purchases).

### 5. Save raw output

Write the combined Pluggy API responses (with `_holder`, `_accountType`, `_accountName` metadata per transaction) to:

```
resources/{YYYY-MM}/expenses/transactions_pluggy_raw.json
```

### 6. Normalize

Transform each Pluggy transaction into the unified format and write to:

```
resources/{YYYY-MM}/expenses/transactions_raw.json
```

Normalized fields: `date` (YYYY-MM-DD), `description`, `amount` (string), `category_name`, `account_name`, `holder`.

**Normalization rules:**
- **Holder**: resolved from `pluggy_items.json` using the transaction's parent item ID
- **Account type**: `BANK` → `savings`, `CREDIT` → `cc`
- **Currency**: when `currencyCode` is not `BRL`, use `amountInAccountCurrency` (the BRL equivalent) instead of `amount` (which is in the foreign currency). All amounts in `transactions_raw.json` must be in BRL.
- **Amount sign**: Pluggy BANK uses negative=debit, positive=credit. CREDIT uses positive=expense, negative=payment/refund.
- **Description**: for BANK transfers, prefer `paymentData.payer.name` (credits) or `paymentData.receiver.name` (debits) when available
- **Dedup**: when merging with an existing `transactions_raw.json`, match on `date|description|amount` to avoid duplicates

## CSV Fallback

If Pluggy is unavailable or the user provides CSVs manually in `resources/{YYYY-MM}/expenses/input/`, parse them instead:
- **Credit card** (`date,title,amount`): holder from filename prefix (`cc-{holder}-*`)
- **Savings account** (`Data,Valor,Identificador,Descricao`): date in DD/MM/YYYY, holder from filename prefix (`savings-{holder}-*`)

## Output

After running, `resources/{YYYY-MM}/expenses/transactions_raw.json` is ready for `/compile` to consume.
