---
name: compile
description: Generate a monthly categorized budget JSON by running fetch + recompile, then classifying leftovers and forecasting partial months. Use when the user asks to generate, create, or analyze a monthly budget, expenses, or income.
---

# Compile Budget

Full monthly pipeline. `{household}` (e.g. `trevo`) scopes all data under `resources/{household}/`.
Output is the canonical flat array in [SCHEMA.md](../../SCHEMA.md) at
`resources/{household}/{YYYY-MM}/expenses/result/budget_{mmm}_{YYYY}.json`.

## Pipeline

```
node plugins/open-personal-finance/scripts/fetch.mjs     --household {h} --month {YYYY-MM}
node plugins/open-personal-finance/scripts/recompile.mjs --household {h} --month {YYYY-MM}
```

1. **`/fetch`** → raw + split files.
2. **`/recompile`** → builds the canonical budget: auto-classifies expenses/income from
   `expenses_memory.md` / `income_memory.md`, preserves any prior classifications, parses
   installment fields, enriches opaque descriptions. Prints rows left `unclassified`.
3. **`/classify`** (or `/categorize` + `/recognize` for a first full pass) the `unclassified`
   rows so they consult memory, get classified, and persist new patterns. Re-run `/recompile`
   to apply the new patterns.
4. **`/forecast`** — for a partial month only, add provisional income (salary) and recurring
   fixed expenses as `provisional: true` rows. `/recompile` carries these forward and
   reconciles them as the real transactions post.
5. **`/audit`** → `node .../audit.mjs --household {h} --month {YYYY-MM}` (auto-fixes, retries).
6. **`/advise`** → generates and sends the two Telegram messages (it calls `/notify`).

## Reference

- `expenses_memory.md` — merchant → category/subcategory rules (drives auto-classification).
- `income_memory.md` — salary definitions, amount ranges, date windows, known income.
- Keep these current via `/classify` and `/learn`; they are the single source of truth, so
  the scripts never need per-month edits.
