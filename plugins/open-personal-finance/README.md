# open-personal-finance

Claude Code skills for personal finance using Pluggy Open Finance.

## How it works

There are two entry paths into the pipeline:

### Full compile (cold start / fresh month)

```
cc_open_bill.json + cc_closed_bill.json + savings.json
                        |
                    /compile
                        |
   fetch -> recognize -> categorize -> forecast -> audit -> advise -> notify
                        |
                        v
              budget_{month}_{year}.json
              (flat JSON array of classified transactions)
```

Used when there is no prior `budget_*.json` for the month, or to rebuild from scratch.
`/categorize` is the **whole-month batch** classifier — it walks every expense row.

### Heartbeat (incremental update — preserves prior classifications)

```
existing budget_{month}_{year}.json + new Pluggy rows
                        |
                    /heartbeat
                        |
   fetch -> merge raw files -> recompile (carry old classifications)
                            -> /classify per unclassified row
                            -> audit -> advise -> notify
                        |
                        v
              budget_{month}_{year}.json (updated, classifications preserved)
```

Used to refresh the current month without losing manual overrides or prior categorizations.
`/classify` is the **delta-oriented** classifier — it only handles rows still marked
`unclassified` after recompile, consults memory, and persists any new merchant pattern.

## Skills

| Skill | Description |
|---|---|
| **`/onboard`** | Interactive setup — household, credentials, memory files |
| **`/compile`** | Full pipeline: fetch -> recognize -> categorize -> forecast -> advise -> notify |
| **`/fetch`** | Pulls transactions from Pluggy and writes the three raw files |
| **`/recognize`** | Marks income and skipped internal movements |
| **`/categorize`** | Whole-month batch: fills `bucket`, `category`, `subcategory` on expense rows. Called by `/compile` |
| **`/classify`** | Delta-oriented: classifies 1+ specific transactions and persists new patterns to memory. Called by `/heartbeat` for residual `unclassified` rows |
| **`/forecast`** | Provisions income + recurring expenses for partial months |
| **`/heartbeat`** | Incremental update without losing prior classifications |
| **`/settle`** | Finalizes previous month, heartbeats current month |
| **`/audit`** | Validates schema, auto-fixes issues (up to 3 retries) |
| **`/learn`** | Persists new patterns to memory files (used after `/categorize` whole-month batches) |
| **`/advise`** | Generates budget insights |
| **`/notify`** | Sends insights via Telegram |

## Data contract

- Three raw files are the month-level source inputs
- Final result is a flat top-level JSON array — no nested trees, no summaries
- The [viewer](https://github.com/icesnow10/personal-finance-viewer) handles grouping and totals
