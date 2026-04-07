# open-personal-finance

Claude Code skills for personal finance using Pluggy Open Finance.

## Core Contract

Pipeline:
- `transactions_pluggy_raw.json` -> `result/budget_{month}_{year}.json`

Rules:
- Pluggy raw file is the only month-level source input.
- Final result file is flat and transaction-level only.
- Use `transactions_pluggy_raw.json` as the only month source file.
- No grouped `expenses.by_category`.
- No summaries or bucket rollups in the final JSON.
- Grouping belongs to the viewer.

## Skills

| Skill | What it does |
|---|---|
| `/fetch` | Writes `transactions_pluggy_raw.json` for the month. |
| `/compile` | Produces a flat monthly `budget_*.json` file as a top-level JSON array of transaction rows. |
| `/recognize` | Marks `income` and `skipped` rows. |
| `/categorize` | Fills `bucket`, `category`, and `subcategory` on expense rows. |
| `/audit` | Validates schema of raw and compiled files; auto-fixes and retries up to 3 times. Called by `/fetch` and `/heartbeat`. |
| `/settle` | Closes the previous month by removing provisional rows, then runs `/heartbeat` for the current month. |
| `/transactions` | Lists rows from the final flat result. |
| `/classified` | Lists classified expense rows from the final flat result. |
| `/missing` | Lists rows still marked `unclassified`. |
