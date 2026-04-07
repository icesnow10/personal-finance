---
name: audit
description: Validate the schema of monthly budget output and raw transaction files. Checks required fields, types, and structural rules. Use when /fetch or /heartbeat call it, or when the user asks to audit, validate, or check a month's data integrity.
---

# Audit

Validates that monthly data files conform to the expected schema. Run automatically by `/fetch` (on raw file) and `/heartbeat` (on compiled budget), or manually by the user.

## Files to validate

### Raw file: `transactions_pluggy_raw.json`

Location: `resources/{household}/{YYYY-MM}/expenses/transactions_pluggy_raw.json`

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

Checks:
- File parses as valid JSON.
- Top-level value is an array (not wrapped in an object).
- Every row contains all required fields above.
- No duplicate `id` values.
- All `date` values match `YYYY-MM-DD` format.
- All `amount` values are numbers.

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

## How to run

1. Determine which file(s) to audit:
   - When called by `/fetch`: audit only `transactions_pluggy_raw.json`.
   - When called by `/heartbeat`: audit only `budget_{month}_{year}.json`.
   - When called manually by the user: audit both files for the requested month.

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
