---
name: settle
description: Finalize the previous month (strip provisionals) and then run heartbeat for the current month.
---

# Settle

Closes the previous month, then updates the current one.

## 1. Finalize the previous month

Refresh from the raw files and recompile **with `--final`** to strip all provisional rows
(a closed month must contain only real transactions):

```
node plugins/open-personal-finance/scripts/recompile.mjs --household {h} --month {prev YYYY-MM} --final
node plugins/open-personal-finance/scripts/audit.mjs     --household {h} --month {prev YYYY-MM}
```

If `/recompile` prints any `unclassified` rows, run `/classify` on them and recompile again
before auditing — the closed month should be fully classified.

## 2. Heartbeat the current month

Run `/heartbeat` for the current month (fetch → recompile → classify → audit → advise →
notify). That produces and sends the current-month budget message.
