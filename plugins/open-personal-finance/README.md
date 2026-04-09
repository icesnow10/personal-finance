# open-personal-finance

Claude Code skills for personal finance using Pluggy Open Finance.

## Core Contract

Pipeline:
- `cc_open_bill.json` + `cc_closed_bill.json` + `savings.json` -> `result/budget_{month}_{year}.json`

Rules:
- Three raw files are the month-level source inputs (CC open bill, CC closed bill, savings).
- Final result file is flat and transaction-level only.
- No grouped `expenses.by_category`.
- No summaries or bucket rollups in the final JSON.
- Grouping belongs to the viewer.

## Skills

| Skill | What it does |
|---|---|
| `/fetch` | Writes `cc_open_bill.json`, `cc_closed_bill.json`, and `savings.json` for the month. |
| `/compile` | Produces a flat monthly `budget_*.json` file as a top-level JSON array of transaction rows. |
| `/recognize` | Marks `income` and `skipped` rows. |
| `/categorize` | Fills `bucket`, `category`, and `subcategory` on expense rows. |
| `/audit` | Validates schema of raw and compiled files; auto-fixes and retries up to 3 times. Called by `/fetch` and `/heartbeat`. |
| `/learn` | Detects new patterns from classified rows and persists to memory files. Called by `/categorize`, `/recognize`, `/classify`. |
| `/settle` | Closes the previous month by removing provisional rows, then runs `/heartbeat` for the current month. |
| `/transactions` | Lists rows from the final flat result. |
| `/classified` | Lists classified expense rows from the final flat result. |
| `/missing` | Lists rows still marked `unclassified`. |
