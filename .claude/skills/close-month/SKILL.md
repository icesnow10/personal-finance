---
name: close-month
description: Closes the previous month's budget if still partial, then triggers /heartbeat for the current month. Ensures last month has a final, complete budget before moving on. Designed for scheduled triggers at the start of each month. Use when scheduled, or when the user asks to "close month", "finalize last month", or "wrap up".
---

# Close Month — Finalize Previous + Pulse Current

Ensures the previous month has a final, complete budget (no provisional items), then triggers `/heartbeat` to update the current month. Runs fully unattended.

## When to Use

- Scheduled trigger at the start of each month (e.g. 3rd of every month to allow late transactions)
- Manual "close last month" requests
- Called before `/heartbeat` to guarantee clean month boundaries

## Flow

### 1. Determine months

- **Previous month**: derive from today's date (e.g. if today is 2026-04-03, previous = 2026-03)
- **Current month**: today's month (e.g. 2026-04)

### 2. Check if previous month needs closing

Read `resources/{prev-YYYY-MM}/expenses/result/budget_*.json`:

- **If not found**: previous month was never compiled — run full `/compile` for it as a complete month
- **If found and `partial: true`**: needs closing — re-compile as complete
- **If found and `partial: false`**: already closed — skip to step 4

### 3. Close previous month

Run `/compile` for the previous month with:
- `partial: false` — this is a final compilation
- Fetch latest transactions from Pluggy for the previous month's full date range (1st to last day)
- Merge with existing `transactions_raw.json` (append-only, same as `/heartbeat`)
- Remove all `provisional: true` items — replace with actuals
- Remove the `forecast` field
- Classify using existing `expenses_memory.md` mappings only
- Leave new uncategorized items in the `unclassified` array with a note

**Preservation rules** (same as `/heartbeat`):
- Keep existing classifications
- Keep user manual overrides
- Never modify `expenses_memory.md`, `income_inputs.md`, or `pluggy_items.json`

### 4. Log close

Append to `resources/{prev-YYYY-MM}/expenses/heartbeat_log.md`:

```markdown
## Close — {YYYY-MM-DD HH:MM}

- Status: closed (partial: false)
- Total transactions: {count}
- Income: R$ {total}
- Expenses: R$ {total}
- Net: R$ {net}
- Uncategorized: {count} items
- Budget written to: {file path}
```

### 5. Trigger heartbeat for current month

Run `/heartbeat` for the current month. This will:
- Fetch new transactions for the current month
- Compile as partial (with provisioning)
- Log the heartbeat summary

### 6. Output summary

Report both actions:

```
Previous month (YYYY-MM): {closed | already closed | first compile}
Current month (YYYY-MM): heartbeat complete — {new_tx_count} transactions, R$ {net} net
```

## Rules

- **Never prompt for user input** — fully unattended
- **Append-only** — same data preservation rules as `/heartbeat`
- **Read-only for reference files** — expenses_memory, income_inputs, pluggy_items
- If previous month close fails, log the error but still attempt current month heartbeat
- If `.env.local` or `pluggy_items.json` is missing, log: "Run /onboard first"
