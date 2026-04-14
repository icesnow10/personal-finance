# open-personal-finance

Claude Code skills for personal finance using Pluggy Open Finance.

## Pipeline

```
cc_open_bill.json + cc_closed_bill.json + savings.json
                        |
                    /compile
                        |
                        v
              budget_{month}_{year}.json
              (flat JSON array of classified transactions)
```

## Skills

| Skill | Description |
|---|---|
| **`/onboard`** | Interactive setup — household, credentials, memory files |
| **`/compile`** | Full pipeline: fetch -> recognize -> categorize -> forecast -> advise -> notify |
| **`/fetch`** | Pulls transactions from Pluggy and writes the three raw files |
| **`/recognize`** | Marks income and skipped internal movements |
| **`/categorize`** | Fills `bucket`, `category`, `subcategory` on expense rows |
| **`/forecast`** | Provisions income + recurring expenses for partial months |
| **`/heartbeat`** | Incremental update without losing prior classifications |
| **`/settle`** | Finalizes previous month, heartbeats current month |
| **`/audit`** | Validates schema, auto-fixes issues (up to 3 retries) |
| **`/learn`** | Persists new patterns to memory files |
| **`/advise`** | Generates budget insights |
| **`/notify`** | Sends insights via Telegram |

## Data contract

- Three raw files are the month-level source inputs
- Final result is a flat top-level JSON array — no nested trees, no summaries
- The [viewer](https://github.com/icesnow10/personal-finance-viewer) handles grouping and totals
