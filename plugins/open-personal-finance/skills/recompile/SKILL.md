---
name: recompile
description: Rebuild a month's canonical budget JSON from raw transactions, auto-classifying from memory and preserving prior work. Use when /compile, /heartbeat, or /settle need to (re)generate budget_*.json.
---

# Recompile

Run the bundled script (no per-month code):

```
node plugins/open-personal-finance/scripts/recompile.mjs --household {household} --month {YYYY-MM}
```

It reads `transactions_raw.json` and the existing `budget_*.json`, then writes the budget
as a **flat canonical array** ([SCHEMA.md](../../SCHEMA.md)):

- **Preserves prior classifications** by `id` — manual `/classify` edits and confirmations win.
- **Auto-classifies NEW rows** by matching descriptions against the household's
  `expenses_memory.md` / `income_memory.md` tables (the single source of truth — no
  hardcoded per-month maps). Unmatched rows are left `type: "unclassified"`.
- Parses installment fields (`installmentNumber`/`totalInstallments`), enriches opaque
  transfer descriptions with the counterparty.
- Carries prior **provisional** rows forward, dropping each once its real counterpart
  posts (salary by holder; recurring expense by category+subcategory).

## After recompile

1. The script prints any rows still `unclassified`. Run **`/classify`** on them so it
   consults memory, classifies, and persists new merchant patterns back to memory.
2. Run **`/audit`**, then **`/advise`**.

Keep `expenses_memory.md` / `income_memory.md` current — they are what makes the
auto-classification work without touching code.
