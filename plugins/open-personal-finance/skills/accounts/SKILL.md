---
name: accounts
description: Discover and map Pluggy accounts to holders and banks. Authenticates, calls Identity/Item/Accounts APIs, and saves pluggy_items.json. Use when /fetch calls it, or when the user asks to list/map/refresh accounts.
---

# Accounts — Pluggy Item Discovery

Discovers all Pluggy items, resolves the holder (Identity API), bank (Item API), and accounts (Accounts API), and saves the mapping to `resources/{household}/pluggy_items.json`.

## Household

The `{household}` is a short lowercase name (e.g. `household-1`) that scopes all data. Determined from context or by asking.

## Credentials

Read from `.env.local` at the project root:

```
PLUGGY_CLIENT_ID=...
PLUGGY_CLIENT_SECRET=...
PLUGGY_ITEM_IDS=id1,id2   # comma-separated, one per bank connection
```

## Output File

`resources/{household}/pluggy_items.json`:

```jsonc
{
  "items": {
    "<item-id>": {
      "holder": "holder1",  // fullName from Identity API
      "bank": "Nubank",               // resolved from COMPE code (see step 4)
      "accounts": {
        "<account-id>": {
          "type": "BANK",              // BANK or CREDIT
          "subtype": "CHECKING_ACCOUNT",
          "name": "Conta Corrente",
          "number": "02215235-0"       // account number from Accounts API
        }
      }
    }
  }
}
```

## Flow

Use `node -e` (not `jq` — unavailable on Windows). Source credentials via `source .env.local` before the node inline script.

### 1. Authenticate

```
POST https://api.pluggy.ai/auth
Body: { "clientId": "...", "clientSecret": "..." }
→ { "apiKey": "..." }   // valid ~2 hours
```

### 2. Read existing mapping

If `resources/{household}/pluggy_items.json` exists, read it. Only process item IDs from `PLUGGY_ITEM_IDS` that are **not yet in the file** (new items). If all items are already mapped, skip to step 6.

### 3. Resolve holder (Identity API)

For each new item:

```
GET https://api.pluggy.ai/identity?itemId={itemId}
Header: X-API-KEY: {apiKey}
→ { "id", "itemId", "fullName", "document", "financialRelationships": { "accounts": [{ "compeCode", "number", ... }] }, ... }
```

Use `fullName` as `holder`. If the endpoint returns empty results (some connectors don't support it), fall back to asking the user.

### 4. Resolve bank

Fetch both the Item API and the Accounts API, then resolve the bank name using this priority:

1. **BANK account `bankData.transferNumber`** — parse the COMPE code from the prefix (e.g. `"260/0001/02215235-0"` → code `260`). Map known codes to bank names (see table below).
2. **Identity `financialRelationships.accounts[].compeCode`** — same COMPE code, use as fallback if `bankData` is unavailable.
3. **Item `connector.name`** — only use if it's NOT `"MeuPluggy"` (MeuPluggy is an aggregator, not a bank). If connector is a direct bank integration, `connector.name` is the real bank name.
4. **BANK account `name`** — some accounts include the institution name (e.g. `"Nu Pagamentos S.A. - Instituição de Pagamento"`). Use as last resort.

#### COMPE code → bank name mapping

| Code | Bank |
|---|---|
| 001 | Banco do Brasil |
| 033 | Santander |
| 104 | Caixa Econômica |
| 237 | Bradesco |
| 260 | Nubank |
| 341 | Itaú |
| 077 | Inter |
| 212 | Banco Original |
| 336 | C6 Bank |
| 290 | PagSeguro |
| 380 | PicPay |
| 323 | Mercado Pago |

For unlisted codes, use the account `name` or ask the user.

**Item API call** (used for `connector.name` fallback):

```
GET https://api.pluggy.ai/items/{itemId}
Header: X-API-KEY: {apiKey}
→ { "connector": { "name": "MeuPluggy" | "Nu Pagamentos S.A.", ... }, ... }
```

### 5. Resolve accounts (Accounts API)

```
GET https://api.pluggy.ai/accounts?itemId={itemId}
Header: X-API-KEY: {apiKey}
→ { "results": [{ "id", "type" (BANK|CREDIT), "subtype", "name", "number", "bankData": { "transferNumber": "260/0001/12345-6", ... } }] }
```

Save each account's `id`, `type`, `subtype`, `name`, and `number`.

### 6. Save mapping

Merge new items into the existing file (or create it) and write to `resources/{household}/pluggy_items.json`.

## When to Run

- **Called by `/fetch`** before fetching transactions — ensures `pluggy_items.json` exists and is up to date
- **Called by `/onboard`** during first-time setup
- **Run directly** when the user adds a new bank connection (new item ID in `PLUGGY_ITEM_IDS`) or asks to refresh/list accounts

## Rules

- Never remove existing items from `pluggy_items.json` — only add new ones or update existing
- If an item ID in `PLUGGY_ITEM_IDS` is already in the file, skip it (don't re-fetch)
- If Identity API fails or returns empty, ask the user for the holder name
- Always save after resolving — even if only one new item was added
