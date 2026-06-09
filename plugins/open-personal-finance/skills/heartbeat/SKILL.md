---
name: heartbeat
description: Fetch new Pluggy rows for the current month and recompile while preserving prior classifications. Use for the recurring mid-month update of the open month.
---

# Heartbeat

Incremental update of the current (open) month. Run the bundled scripts in order:

```
node plugins/open-personal-finance/scripts/fetch.mjs     --household {h} --month {YYYY-MM}
node plugins/open-personal-finance/scripts/recompile.mjs --household {h} --month {YYYY-MM}
```

`/recompile` preserves prior classifications, auto-classifies new rows from memory, parses
installment fields, enriches descriptions, and reconciles provisionals against posted reality.
It prints any rows still `unclassified`.

Then:

1. **`/classify`** the printed `unclassified` rows — it consults `expenses_memory.md` /
   `income_memory.md`, classifies them, and persists new merchant patterns to memory. Re-run
   `/recompile` so the new memory patterns apply (or edit the rows directly).
2. **`/audit`** — `node .../audit.mjs --household {h} --month {YYYY-MM}` (auto-fixes, retries).
3. **`/advise`** — generates and sends both Telegram messages (it calls `/notify`).

The open credit-card bill lists the whole cycle's installments with future scheduled dates;
include them all. A fresh month's first fetch can be incomplete — re-run `/fetch` if a new
month returns suspiciously few card rows.
