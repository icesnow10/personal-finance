---
name: heartbeat
description: Fetch new Pluggy rows for the current month and recompile while preserving prior classifications.
---

# Heartbeat

## Read

- `resources/{household}/{YYYY-MM}/expenses/cc_open_bill.json`
- `resources/{household}/{YYYY-MM}/expenses/cc_closed_bill.json`
- `resources/{household}/{YYYY-MM}/expenses/savings.json`
- `resources/{household}/{YYYY-MM}/expenses/result/budget_*.json`
- `resources/{household}/expenses_memory.md`
- `resources/{household}/income_memory.md`

## Rules

- Merge new rows into the corresponding raw file (`cc_open_bill.json`, `cc_closed_bill.json`, or `savings.json`) based on `_accountType` and `status`.
- A transaction may move between files (e.g. PENDING → POSTED means it moves from `cc_open_bill.json` to `cc_closed_bill.json`). When this happens, remove it from the old file and add it to the new one.
- Deduplicate by Pluggy transaction `id` within each file.
- Recompile to a flat `budget_*.json` that is a top-level JSON array of rows.
- **Reconcile provisionals with newly-observed reality.** Before writing the recompiled budget, walk every real (non-provisional) row and, per the rules in `/categorize` (expenses) and `/recognize` (income), reduce the matching provisional's amount by the observed value. Drop the provisional row when the remainder is ≤ R$ 0,01; otherwise keep it with the reduced amount. This prevents double-counting when a provisioned expense/salary lands as a real Pluggy transaction between heartbeats.
- After recompiling, run `/audit` on `budget_*.json`. Audit auto-fixes issues and retries up to 3 times. Only stop if auto-fix exhausts all attempts.
- After audit passes, run `/advise` to produce the formatted monthly budget message. `/advise` already calls `/notify` internally — do NOT call `/notify` again from heartbeat.
- The three raw files are the month source files.
