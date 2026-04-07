---
name: heartbeat
description: Fetch new Pluggy rows for the current month and recompile while preserving prior classifications.
---

# Heartbeat

## Read

- `resources/{household}/{YYYY-MM}/expenses/transactions_pluggy_raw.json`
- `resources/{household}/{YYYY-MM}/expenses/result/budget_*.json`
- `resources/{household}/expenses_memory.md`
- `resources/{household}/income_memory.md`

## Rules

- Merge new rows into `transactions_pluggy_raw.json`.
- Deduplicate by Pluggy transaction `id`.
- Recompile to a flat `budget_*.json` that is a top-level JSON array of rows.
- After recompiling, run `/advise` to produce the formatted monthly budget message.
- After `/advise`, run `/notify` if Telegram is configured. If Telegram is not configured, skip silently.
- Only maintain `transactions_pluggy_raw.json` as the month source file.
