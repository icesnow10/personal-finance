---
name: heartbeat
description: Periodic pulse for the current month. Fetches NEW transactions from Pluggy and appends them to existing data, then re-compiles the budget. Never overwrites existing classifications or user edits. Designed for scheduled triggers (cron) without user interaction. Use when scheduled or when the user asks to "heartbeat", "pulse", "refresh", or "update" the current month.
---

# Heartbeat — Current Month Pulse

Fetches **new** transactions since the last heartbeat and appends them to existing data. Re-compiles the budget while preserving all prior classifications, user edits, and manual overrides. Runs fully unattended.

## When to Use

- Scheduled triggers (e.g. daily cron via Claude Code)
- Manual "sync" / "refresh" requests
- Keeping a partial month's forecast up to date as new transactions arrive

## Household

The `{household}` is a short lowercase name that scopes all data. Determined from context or from the scheduled trigger configuration.

## Flow

### 1. Determine target month

Use today's date to derive the target month in `YYYY-MM` format.

### 2. Read existing state

Before fetching anything, read what already exists:
- `resources/{household}/{YYYY-MM}/expenses/transactions_raw.json` — existing transactions (may not exist on first sync)
- `resources/{household}/{YYYY-MM}/expenses/result/budget_*.json` — existing compiled budget (may not exist)
- `resources/{household}/expenses_memory.md` — merchant mappings (read-only, never modify)
- `resources/{household}/income_memory.md` — income definitions (read-only, never modify)

Count existing transactions to track what's new.

### 3. Fetch new transactions

Run the `/fetch` pipeline for the target month:
- Authenticate with Pluggy API using credentials from `.env.local`
- Pull all BANK + CREDIT transactions for the full month range
- **Merge with existing `transactions_raw.json`** — deduplicate by `date|description|amount` key
- Only append truly new transactions; never remove or modify existing ones
- If `resources/{household}/pluggy_items.json` already exists, use it (do NOT prompt for holder mapping)
- If Pluggy fails, log the error and abort — do not fall back to CSVs in unattended mode

### 4. Determine if partial or complete

- If today is the last day of the month (or later): `partial: false`
- Otherwise: `partial: true`, `data_through: today's date`

### 5. Compile budget (preserving existing work)

Run the `/compile` pipeline for the target month:
- `/recognize` — identify income using existing rules; provision salary if partial
- `/categorize` — classify expenses using **only** existing mappings from `resources/{household}/expenses_memory.md`
- `/forecast` (if partial) — provision recurring expenses
- Generate budget JSON to `resources/{YYYY-MM}/expenses/result/`

**Preservation rules:**
- If a transaction was already classified in a prior compile, keep its classification
- If a transaction was manually reclassified by the user, preserve the override
- Only classify new (previously unseen) transactions
- New uncategorized merchants stay in the `unclassified` array — do not guess

### 6. Handle uncategorized silently

In unattended mode, do NOT prompt for uncategorized transaction review. Instead:
- Classify what you can using existing merchant mappings from `resources/{household}/expenses_memory.md`
- Leave unmatched transactions in the `unclassified` array
- Add a note: `"Uncategorized items pending review — run /compile interactively to classify"`

### 7. Run /advise

After the budget is compiled, run `/advise` to generate insights (health check, spotlight, momentum, wins/alerts, recommendations).

### 8. Run /notify

After `/advise` generates insights, run `/notify` to send the summary via Telegram. If Telegram is not configured, skip silently.

### 9. Log summary

Append to `resources/{household}/{YYYY-MM}/expenses/heartbeat_log.md` (never overwrite previous entries):

```markdown
## Heartbeat — {YYYY-MM-DD HH:MM}

- Total transactions: {count}
- New since last heartbeat: {count} (+R$ {amount})
- Income: R$ {total} ({provisional note if partial})
- Expenses: R$ {total}
- Net: R$ {net}
- Uncategorized: {count} items ({new_count} new)
- Budget written to: {file path}
```

Also output the summary as your response so the schedule trigger captures it.

## What is NEVER modified

| File / Data | Rule |
|---|---|
| `resources/{household}/expenses_memory.md` | Read-only — only `/compile` interactive or `/categorize` with user review can update |
| `resources/{household}/income_memory.md` | Read-only — only `/onboard` or user can update |
| `resources/{household}/pluggy_items.json` | Read-only — never re-prompt for holder mapping |
| Existing transaction classifications | Preserved — if already categorized, keep it |
| User manual overrides | Preserved — never overwrite reclassifications |
| Previous `heartbeat_log.md` entries | Append-only — never delete prior log entries |

## What IS updated

| File / Data | Rule |
|---|---|
| `transactions_raw.json` | New transactions appended (deduped by date+description+amount) |
| `budget_*.json` | Regenerated with merged data (new + existing classifications) |
| `heartbeat_log.md` | New entry appended |

## Rules

- **Never prompt for user input** — this skill must run fully unattended
- **Append-only for transactions** — never remove or modify existing transaction data
- **Read-only for reference files** — expenses_memory, income_memory, pluggy_items
- **Preserve all user work** — classifications, overrides, manual edits are sacred
- If any step fails, log the error to `heartbeat_log.md` and stop
- If `.env.local` or `resources/{household}/pluggy_items.json` is missing, log an error: "Run /onboard first"
