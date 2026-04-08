---
name: learn
description: Detect new transaction patterns not yet in memory and persist them. Compares classified budget rows against expenses_memory.md and income_memory.md, adds new patterns, and logs what was learned. Use when /categorize or /recognize call it after classification, or when the user asks to learn, sync, or update memory from a month's data.
---

# Learn

Scans a classified budget and persists newly discovered patterns to memory files so future months classify instantly without re-inferring.

## When to run

- Called by `/categorize` after classifying expenses.
- Called by `/recognize` after classifying income and skipped rows.
- Called by `/classify` after manual classification.
- Called manually by the user for any month.

## Input

- The classified budget: `resources/{household}/{YYYY-MM}/expenses/result/budget_{month}_{year}.json`
- The memory files:
  - `resources/{household}/expenses_memory.md` — Known Merchants table
  - `resources/{household}/income_memory.md` — Known income sources

## Process

### 1. Load existing patterns

Read the Known Merchants table from `expenses_memory.md` and the known income/skip patterns from both memory files. Build a set of all existing patterns (case-insensitive).

### 2. Scan classified rows

For each row in the budget where `type` is `income`, `expense`, or `skipped` (skip `unclassified` — nothing to learn from those):

1. Extract the **core merchant name** from `description`:
   - Strip prefixes like `Pagamento efetuado|`, `Transferência enviada|`, `Transferência Recebida|`
   - Strip parenthesized enrichment suffixes `(...)`
   - Trim whitespace
2. Check if this core name (case-insensitive) already matches any existing pattern in memory.
3. If **no match** — this is a new pattern to learn.

### 3. Classify what to persist

For each new pattern found:

- **Expense rows** → add to Known Merchants table in `expenses_memory.md` with the `category` and `subcategory` from the row.
- **Income rows** → add to Known Merchants in `expenses_memory.md` with `Income` and the `subcategory` (e.g. `Income | Salary (holder1)`). If it matches a salary or recurring pattern, also note it in `income_memory.md` under Other Known Income.
- **Skipped rows** → add to Known Merchants in `expenses_memory.md` with `Skip` and the `subcategory`.

### 4. Detect variants

A variant is a description that matches an existing pattern **partially** but has extra detail (e.g. memory has `Uber*`, new transaction is `Uber *Trip ABC`). Variants should **not** create duplicate entries. Instead:

- If the existing pattern already covers the new description via prefix/substring match, skip it — nothing to learn.
- If the new description is a **more specific** version that the existing pattern wouldn't catch, add it as a new row.

### 5. Write updates

- Append new rows to the **end** of the Known Merchants table in `expenses_memory.md`.
- Append new income sources to `income_memory.md` if applicable.
- Do not modify or reorder existing entries.
- Do not add duplicates.

### 6. Report

Log what was learned:

```
Learn — {N} new patterns added:

expenses_memory.md:
+ Bmb*Light → Housing / Electricity
+ CIPA PARTICIPACOES → Housing / Condo

income_memory.md:
+ (no new patterns)

Already known (skipped): 45 patterns matched existing memory.
```

If nothing new was found:
```
Learn — 0 new patterns. All {N} classified rows already in memory.
```

## Rules

- Never remove or modify existing patterns — only append.
- Never learn from `unclassified` rows — they have no reliable classification yet.
- Never learn from `provisional` rows — they are estimates, not real transactions.
- Case-insensitive matching when checking for existing patterns.
- If a row was classified via Manual Override in `expenses_memory.md`, it is already known — skip it.
- Preserve the merchant name as it appears in the transaction, not a cleaned-up version. This ensures exact matching in future runs.
