---
name: settle
description: Finalize the previous month and then run heartbeat for the current month.
---

# Settle

## Rules

- Refresh the previous month from `transactions_pluggy_raw.json`.
- Recompile the previous month as a complete flat `budget_*.json`.
- Strip all provisional rows from the final closed month.
- Then run `/heartbeat` for the current month.
- Only use `transactions_pluggy_raw.json` as the month source file.
