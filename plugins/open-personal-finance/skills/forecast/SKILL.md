---
name: forecast
description: Forecast a partial month's full budget by provisioning both income (/recognize) and recurring expenses (/provision). Combines salary provisioning with fixed expense estimates to project meaningful budget numbers mid-month. Use when the user asks to forecast, project, or estimate a partial month's budget.
---

# Forecast

Provisions both income and recurring expenses for a partial/open month by orchestrating `/recognize` and `/provision`.

## When to Use

- Partial months where salary and/or fixed expenses haven't appeared yet
- Mid-month budget projections
- Called by `/compile` for partial months

## Household

The `{household}` is a short lowercase name that scopes all data. Determined from context or by asking.

## Pipeline

### 1. Run /recognize

Identify actual income from observed transactions + provision expected salary that hasn't arrived yet (using definitions from `resources/{household}/income_memory.md`).

### 2. Run /provision

Estimate recurring fixed expenses that haven't appeared yet, using prior completed months as baseline. Read provisioning rules and provisionable categories from `resources/{household}/expenses_memory.md`.

### 3. Merge

Combine provisioned income and provisioned expenses into a unified forecast. All provisioned items are marked with `"provisional": true`.

## Provisioning Rules

- **Never bundle** provisioned items — each subscription/expense gets its own line item with individual amount
- **Never provision IOF** — IOF is unpredictable and should only appear as actual charges
- **Use prior months' actuals** to determine individual amounts for each provisioned item
- Provisioned descriptions end with ` - provisioned`
- Check `resources/{household}/expenses_memory.md` for which categories/subscriptions are currently active vs cancelled

## Output

### JSON `forecast` field

Add a top-level `forecast` object (see `ForecastSummary` in `src/lib/types.ts`):

```json
{
  "forecast": {
    "forecasted_income": ...,
    "forecasted_expenses": ...,
    "actual_income": ...,
    "actual_expenses": ...,
    "provisional_income": ...,
    "provisional_expenses": ...
  }
}
```

### Transaction-level tagging

- All provisioned items have `"provisional": true` on both `IncomeItem` and `Transaction`
- Actual and provisioned items coexist in the same `by_category` structure
- `income.total` and `expenses.total` include both actual + provisional
- `summary` and `budget_buckets` are computed on the full forecasted totals

### When month completes

When the month is re-compiled with full data, remove:
- The `forecast` field
- All `provisional: true` items (replaced by actuals)
- The `partial` flag
