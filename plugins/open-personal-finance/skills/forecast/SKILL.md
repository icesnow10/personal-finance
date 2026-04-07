---
name: forecast
description: Forecast a partial month's full budget by provisioning both income (/recognize) and recurring expenses (/provision). Appends provisional rows into the same top-level flat month array. Use when the user asks to forecast, project, or estimate a partial month's budget.
---

# Forecast

Provisions both income and recurring expenses for a partial or open month by orchestrating `/recognize` and `/provision`, then appending those provisional rows into the same top-level flat month array.

## When to Use

- Partial months where salary and or fixed expenses have not appeared yet
- Mid-month budget projections
- Called by `/compile` for partial months

## Household

The `{household}` is a short lowercase name that scopes all data. Determined from context or by asking.

## Pipeline

### 1. Run /recognize

Identify actual income from observed transactions and provision expected salary that has not arrived yet, using definitions from `resources/{household}/income_memory.md`.

### 2. Run /provision

Estimate recurring fixed expenses that have not appeared yet, using prior completed months as baseline. Read provisioning rules and provisionable categories from `resources/{household}/expenses_memory.md`.

### 3. Merge

Combine provisioned income and provisioned expenses into the same canonical top-level JSON array. All provisioned items are marked with `"provisional": true`.

## Provisioning Rules

- **Never bundle** provisioned items - each subscription or expense gets its own line item with its own amount
- **Never provision IOF** - IOF is unpredictable and should only appear as actual charges
- Use prior months' actuals to determine individual amounts for each provisioned item
- Provisioned descriptions end with ` - provisioned`
- Check `resources/{household}/expenses_memory.md` for which categories and subscriptions are currently active vs cancelled

## Output

Return additional flat transaction rows only.

- Do not add a top-level `forecast` object.
- Do not add `summary`, `budget_buckets`, `by_category`, or any other grouped dashboard fields.
- All provisioned items must appear as normal rows in the top-level JSON array.
- Every provisioned row must keep the same transaction-level shape used by `/compile`, including `id`, `type`, `description`, `amount`, `holder`, `bank`, `account_number`, `source`, and `provisional: true`. **`date` is optional** on provisioned rows — omit it since there is no real transaction date.
- Provisioned expenses must also include `bucket`, `category`, and `subcategory`.
- Provisioned income rows may leave `bucket`, `category`, and `subcategory` as `null`.

### When month completes

When the month is re-compiled with full data, remove:
- All `provisional: true` items, replaced by actuals
- The `partial` flag
