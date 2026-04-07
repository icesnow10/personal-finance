---
name: provision
description: Provision recurring expenses for partial/open months based on historical patterns. Estimates fixed costs that haven't appeared yet so budget buckets show meaningful percentages mid-month. Use when /compile calls it for partial months or when the user asks to provision expenses.
---

# Provision Recurring Expenses

Estimates recurring expenses that haven't yet appeared in a partial month, based on historical patterns from prior months' budget files.

## When to Run

Only for **partial/open months** where the data doesn't cover the full month. Skip entirely for complete months.

## Household

The `{household}` is a short lowercase name that scopes all data. Determined from context or by asking.

## Input

- Target month and `data_through` date
- Already-categorized expenses from `/categorize`
- Prior months' budget JSON files from `resources/{household}/{YYYY-MM}/expenses/result/`
- `resources/{household}/expenses_memory.md` — for provisionable categories, active/cancelled subscriptions, and category-to-bucket mappings

## Process

1. **Read** the 2 most recent completed months' budget JSONs to establish recurring expense baselines
2. **Read** `resources/{household}/expenses_memory.md` to check which subscriptions are currently active vs cancelled
3. **Identify recurring expenses** — categories/subcategories that appear consistently with similar amounts
4. **Compare** against already-observed expenses for the current partial month
5. **Provision** missing recurring items that haven't appeared yet

## Provisionable Categories

Only provision categories with predictable recurring amounts. Read the specific list from `resources/{household}/expenses_memory.md`. General guidelines:

**Provision these (if recurring and active):**
- Housing fixed costs (rent, condo, utilities, cleaning)
- Insurance
- Health: only recurring plans (not pharmacy, labs, etc.)
- Subscriptions (only currently active ones)
- Wellness memberships

**Never provision:**
- Groceries, Food/Dining, Transportation, Shopping, Travel, Recreation, Services, Personal Care, Family Support
- Health (except recurring plans)
- IOF — never provision IOF charges
- Cancelled or one-off subscriptions

## Provisioning Rules

- **Never bundle** — each provisioned item gets its own line with its own amount. No "Cursor, OpenAI, Elevenlabs" bundles.
- Use the **average of the last 2 months** as the expected amount for each individual item
- Mark all provisioned expenses with `"provisional": true`
- **`date` is optional** on provisioned items — omit it since there is no real transaction date
- Provisioned descriptions end with ` - provisioned`
- **Do not provision** items already observed in the current partial month (match by merchant pattern)
- **Check `resources/{household}/expenses_memory.md`** for cancelled subscriptions before provisioning — do not provision cancelled services
- One-off annual charges should not be provisioned monthly

## Output

Returns a list of provisioned expense items with expected amounts, for `/compile` to merge into the report alongside actual expenses. Each provisioned item should include `bank` and `account_number` from the historical transaction it was based on (or `null` if unknown).
