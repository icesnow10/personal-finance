---
name: audit
description: Validate the schema of monthly budget output and raw transaction files. Checks required fields, types, and structural rules. Use when /fetch or /heartbeat call it, or when the user asks to audit, validate, or check a month's data integrity.
---

# Audit

Validates that monthly data files conform to the expected schema. Run automatically by `/fetch` (on raw file) and `/heartbeat` (on compiled budget), or manually by the user.

## Files to validate

### Raw files

Three separate raw files, all under `resources/{household}/{YYYY-MM}/expenses/`:

| File | Contents |
|---|---|
| `cc_open_bill.json` | Credit card transactions with status `PENDING` (open bill) |
| `cc_closed_bill.json` | Credit card transactions with status `POSTED` (closed bill) |
| `savings.json` | Savings/checking account (BANK type) transactions |

Must be a top-level JSON array. Each row must have:

| Field | Type | Required |
|---|---|---|
| `id` | string | yes |
| `accountId` | string | yes |
| `description` | string | yes |
| `amount` | number | yes |
| `date` | string (YYYY-MM-DD) | yes |
| `_holder` | string | yes |
| `_bank` | string | yes |
| `_accountType` | string (`BANK` or `CREDIT`) | yes |
| `_accountName` | string | yes |
| `_accountNumber` | string | yes |

Raw files preserve the full Pluggy API response. Installment data lives inside `metadata.totalInstallments` and `metadata.installmentNumber` (not at the top level). Other Pluggy fields (`currencyCode`, `category`, `categoryId`, `status`, `type`, `operationType`, `merchant`, `createdAt`, `updatedAt`, etc.) are also present and should not be removed or flagged.

Checks:
- File parses as valid JSON.
- Top-level value is an array (not wrapped in an object).
- Every row contains all required fields above.
- No duplicate `id` values.
- All `date` values are valid ISO date strings (full ISO 8601 datetime from Pluggy, e.g. `2026-04-05T03:00:00.000Z`, is acceptable — do not reject these).
- All `amount` values are numbers.
- If `metadata.totalInstallments` is present, `metadata.installmentNumber` must also be present (and vice versa).
- **Account number validation**: every `_accountNumber` must match one of the `number` values in `pluggy_items.json` for the corresponding holder. Load `resources/{household}/pluggy_items.json`, build the set of valid account numbers, and flag any row whose `_accountNumber` is not in that set.
  - Auto-fix: look up the row's `accountId` in `pluggy_items.json` and replace `_accountNumber` with the correct `number`. If `accountId` is not found in `pluggy_items.json`, flag for user review.

### Compiled file: `budget_{month}_{year}.json`

Location: `resources/{household}/{YYYY-MM}/expenses/result/budget_{month}_{year}.json`

Must be a top-level JSON array. Each row must have:

| Field | Type | Required |
|---|---|---|
| `id` | string | yes |
| `type` | string (`income`, `expense`, `skipped`, `unclassified`) | yes |
| `description` | string | yes |
| `amount` | number | yes |
| `date` | string (YYYY-MM-DD) | required for non-provisional rows |
| `holder` | string | yes |
| `bank` | string | yes (may be `null` for provisional) |
| `account_number` | string | yes (may be `null` for provisional) |
| `source` | string | yes (may be `null` for provisional) |
| `totalInstallments` | number | no — carry from raw when present |
| `installmentNumber` | number | no — carry from raw when present |

Additional rules by type:
- `expense` rows **must** have non-null `bucket`, `category`, and `subcategory`.
- `bucket` must be one of: `custos_fixos`, `conforto`, `liberdade_financeira`.
- `income`, `skipped`, and `unclassified` rows may have `bucket`, `category`, `subcategory` as `null`.
- Rows with `"provisional": true` may omit `date`.
- Non-provisional rows **must** have a `date` in `YYYY-MM-DD` format.

Structural checks:
- File parses as valid JSON.
- Top-level value is an array (not wrapped in an object).
- No duplicate `id` values.
- No top-level keys like `transactions`, `summary`, `budget_buckets`, `net`, or any wrapper object.
- All `amount` values are numbers.
- `type` is one of the four allowed values.
- **Account number validation**: for non-provisional rows, `account_number` must match one of the `number` values in `pluggy_items.json`. Load `resources/{household}/pluggy_items.json`, build the set of valid account numbers, and flag any row whose `account_number` is not in that set and is not `null`/provisional.
  - Auto-fix: find the corresponding raw transaction by `id` in `cc_open_bill.json`, `cc_closed_bill.json`, or `savings.json`, get its `accountId`, look it up in `pluggy_items.json`, and replace `account_number` with the correct `number`. If the raw transaction is not found or `accountId` is missing from `pluggy_items.json`, flag for user review.

## Description enrichment check (compiled file only)

Opaque or generic descriptions must have a clarifying suffix appended in parentheses after classification. Flag any row in the compiled budget where:

- `type` is `income`, `expense`, or `skipped` (i.e. already classified, not `unclassified`)
- AND `description` matches a known opaque pattern without a parenthesized suffix

Known opaque patterns:
- `Transferência Recebida` (without `|` or `(`)
- `Transferência enviada|<NAME>` (without trailing `(...)`)
- `Pagamento efetuado|<NAME>` (without trailing `(...)`)

Detection rule: if `description` matches one of these patterns and does **not** contain `(`, it is missing enrichment.

Auto-fix: look up the row's `category` and `subcategory` and append ` ({category} - {subcategory})` or a more specific label when available from `expenses_memory.md`. For example:
- `"Pagamento efetuado|GRPQA"` → `"Pagamento efetuado|GRPQA (Aluguel)"`
- `"Transferência Recebida"` with subcategory `FGTS Saque Aniversário` → `"Transferência Recebida (FGTS Saque Aniversário - holder2)"`

Do not enrich `unclassified` rows — only enrich rows that already have a classification.

## Bucket consistency check (compiled file only)

Each `(category, subcategory)` pair in the compiled budget must have a single, consistent `bucket` value across all its rows. When the same pair appears with different buckets, the category leaks into multiple bucket lists in `budget_buckets`, and the Categorias card / bucket progress bars double-count it.

Detection: group expense rows by `(category, subcategory)`. Flag any group whose rows have more than one distinct `bucket` value.

```
Row id="pluggy:abc": (Transportation, Ride-hailing) bucket=conforto, but other rows in the same pair have bucket=custos_fixos
```

Auto-fix: for each inconsistent pair, pick the majority bucket (or, when tied, the bucket declared for the category in `expenses_memory.md`'s Budget Buckets table) and rewrite all rows in that pair to match. Log the override with the row ids that were changed.

## Foreign currency check (compiled file only)

Pluggy returns foreign currency transactions (e.g. international CC purchases) with `amount` in the native currency and `amountInAccountCurrency` already converted to BRL. The compiled budget row must use the BRL value, not the native value.

Detection: for each non-provisional row in the compiled budget, look up the matching raw row by `id` in `cc_open_bill.json`, `cc_closed_bill.json`, or `savings.json`. If the raw row has `currencyCode != "BRL"`, verify that the budget row's `amount` equals the raw row's `amountInAccountCurrency` (tolerance ≤ 0.01). Flag mismatches:

```
Row id="pluggy:abc": USD transaction recorded as 20 (native amount) instead of 105.36 (amountInAccountCurrency)
```

Auto-fix: replace the budget row's `amount` with the raw row's `amountInAccountCurrency`. Preserve the sign (refunds stay negative).

## Encoding checks (applies to both files)

All string fields (`description`, `descriptionRaw`, `_holder`, `holder`, `category`, `subcategory`, etc.) must contain clean UTF-8 text. Check for:

- **Replacement character** `U+FFFD` (`�`) — indicates a corrupted encoding conversion.
- **Garbled sequences** — common mojibake patterns where pt-BR accented characters were double-encoded or decoded with the wrong charset (e.g. `TransferÃªncia` instead of `Transferência`, `Ã§Ã£o` instead of `ção`).
- **BOM** (`U+FEFF`) — must not appear at the start of the file or within any field.

Common pt-BR mojibake patterns and their corrections:

| Broken | Correct |
|---|---|
| `Ã£` | `ã` |
| `Ã¡` | `á` |
| `Ã©` | `é` |
| `Ãª` | `ê` |
| `Ã­` | `í` |
| `Ã³` | `ó` |
| `Ã´` | `ô` |
| `Ãº` | `ú` |
| `Ã§` | `ç` |
| `Ã±` | `ñ` |
| `Ã¢` | `â` |
| `Ã` (followed by space or end) | `À` |

Auto-fix rules:
- Replace `U+FFFD` (`�`): look up the original value from the raw files (`cc_open_bill.json`, `cc_closed_bill.json`, `savings.json`) by matching `id`. If the raw file has the correct character, copy it over. If the raw file also has the replacement character, attempt mojibake repair using the table above.
- Replace mojibake sequences using the table above.
- Strip BOM from file start.
- Log every replacement so the user can review.

## How to run

1. Determine which file(s) to audit:
   - When called by `/fetch`: audit all three raw files (`cc_open_bill.json`, `cc_closed_bill.json`, `savings.json`).
   - When called by `/heartbeat`: audit the compiled `budget_{month}_{year}.json`.
   - When called manually by the user: audit all raw files and the compiled budget for the requested month.

2. Read the file with `node -e` or the Read tool.

3. Parse and validate against the rules above.

4. Report results:

**If all checks pass:**
```
Audit OK — {filename}: {N} rows, 0 issues.
```

**If issues are found, list each one:**
```
Audit FAILED — {filename}: {N} issues found.

1. Row id="pluggy:123": missing field "bucket" (required for type "expense")
2. Row id="pluggy:456": invalid date format "04-05-2026" (expected YYYY-MM-DD)
3. Duplicate id "pluggy:789" found at rows 12 and 45
...
```

5. **If audit fails, auto-fix and retry (up to 3 attempts).**

   On failure:
   1. Read the file that failed audit.
   2. Fix every reported issue in-place:
      - Missing fields → add them with sensible defaults (`null` for optional strings, `0` for amount, `"unclassified"` for missing type).
      - Invalid `date` format → attempt to parse and rewrite as `YYYY-MM-DD`; if unparseable, set to `null` (only allowed on provisional rows — if the row is not provisional, flag it for user review).
      - Duplicate `id` → append a sequential suffix (e.g. `pluggy:123_dup2`) to later duplicates.
      - Invalid `type` value → set to `"unclassified"`.
      - Invalid `bucket` value on expense → set to `null` and change `type` to `"unclassified"`.
      - Top-level object wrapper → extract the array value from the first array-typed key.
      - `U+FFFD` or mojibake in strings → repair using the raw file lookup or the mojibake table from the encoding checks section. Strip BOM from file start.
      - Invalid `_accountNumber` or `account_number` → look up `accountId` in `pluggy_items.json` and replace with the correct `number`. If not resolvable, flag for user review.
      - Opaque description without enrichment → append ` ({category} - {subcategory})` or a specific label from `expenses_memory.md`/`income_memory.md`. Only for already-classified rows.
      - Foreign currency amount mismatch → replace `amount` with the raw `amountInAccountCurrency` (BRL value), preserving the sign. Log the correction.
      - Inconsistent bucket for a `(category, subcategory)` pair → rewrite all rows in the pair to the majority bucket (or the memory-declared bucket when tied). Log row ids changed.
   3. Write the corrected file back.
   4. Re-run audit on the corrected file.
   5. Repeat up to **3 total attempts**. If audit still fails after 3 attempts, **STOP the pipeline**, present the remaining issues to the user, and ask how to proceed.

   Log each fix applied so the user can review what changed:
   ```
   Audit auto-fix (attempt {n}/3):
   - Row id="pluggy:123": added missing field "bucket" = null, changed type to "unclassified"
   - Row id="pluggy:456": reformatted date "04-05-2026" → "2026-04-05"
   - Unwrapped top-level object key "transactions" → flat array
   ```

6. **After audit passes, run `/learn`** on the compiled budget to persist any new patterns to memory files. This is the final step — it ensures that every classified row in a valid budget is captured in memory for future months.
