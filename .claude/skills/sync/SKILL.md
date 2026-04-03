---
name: sync
description: Unattended sync of the current month's budget data. Fetches latest transactions from Pluggy, re-compiles the budget, and logs a summary. Designed to run via scheduled triggers (cron) without user interaction. Use when scheduled or when the user asks to "sync", "refresh", or "update" the current month.
---

# Sync — Automated Monthly Budget Update

Fetches the latest transactions and re-compiles the current month's budget. Runs fully unattended — no user prompts, no uncategorized review, no interactive steps.

## When to Use

- Scheduled triggers (e.g. daily cron via Claude Code)
- Manual "sync" / "refresh" requests
- Keeping a partial month's forecast up to date as new transactions arrive

## Flow

### 1. Determine target month

Use today's date to derive the target month in `YYYY-MM` format.

### 2. Fetch transactions

Run the `/fetch` pipeline for the target month:
- Authenticate with Pluggy API using credentials from `.env.local`
- Pull all BANK + CREDIT transactions for the month
- Normalize and save to `resources/{YYYY-MM}/expenses/transactions_raw.json`
- If `pluggy_items.json` already exists, use it (do NOT prompt for holder mapping)
- If Pluggy fails, log the error and abort — do not fall back to CSVs in unattended mode

### 3. Determine if partial or complete

- If today is the last day of the month (or later): `partial: false`
- Otherwise: `partial: true`, `data_through: today's date`

### 4. Compile budget

Run the `/compile` pipeline for the target month:
- `/recognize` — identify income, provision salary if partial
- `/categorize` — classify expenses using `resources/expenses_memory.md`
- `/forecast` (if partial) — provision recurring expenses
- Generate budget JSON to `resources/{YYYY-MM}/expenses/result/`

### 5. Handle uncategorized silently

In unattended mode, do NOT prompt for uncategorized transaction review. Instead:
- Classify what you can using existing merchant mappings
- Leave unmatched transactions in the `unclassified` array
- Add a note: `"Uncategorized items pending review — run /compile interactively to classify"`

### 6. Compare with previous sync

If a budget JSON already exists for this month, compare:
- New transactions since last sync (count + total amount)
- Changes in income total
- Changes in expense total
- New uncategorized merchants

### 7. Log summary

Write a sync log to `resources/{YYYY-MM}/expenses/sync_log.md` (append, don't overwrite):

```markdown
## Sync — {YYYY-MM-DD HH:MM}

- Transactions fetched: {count}
- New since last sync: {count} (+R$ {amount})
- Income: R$ {total} ({provisional note if partial})
- Expenses: R$ {total}
- Net: R$ {net}
- Uncategorized: {count} items
- Budget written to: {file path}
```

Also output the summary as your response so the schedule trigger captures it.

## Rules

- **Never prompt for user input** — this skill must run fully unattended
- **Never overwrite `expenses_memory.md`** with guesses — only use existing mappings
- **Always preserve existing `pluggy_items.json`** — never ask for holder re-mapping
- If any step fails, log the error to `sync_log.md` and stop
- If `.env.local` or `pluggy_items.json` is missing, log an error: "Run /onboard first"
