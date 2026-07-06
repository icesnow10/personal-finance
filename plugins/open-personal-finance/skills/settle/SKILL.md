---
name: settle
description: Finalize a target month (fetch fresh data, recompile with --final to strip provisionals) and then run heartbeat for the current month. Defaults to settling the previous month.
---

# Settle

Closes a target month, then updates the current one.

`{month}` is the month the user wants to settle (`YYYY-MM`). If the user does not specify
one, default to the **previous** month.

## 1. Finalize the target month

Run the compile pipeline for `{month}`, ending with `--final` so all provisional rows are
stripped (a closed month must contain only real transactions):

```
node plugins/open-personal-finance/scripts/fetch.mjs     --household {h} --month {month}
node plugins/open-personal-finance/scripts/recompile.mjs --household {h} --month {month} --final
node plugins/open-personal-finance/scripts/audit.mjs     --household {h} --month {month} --final
```

The fetch matters: transactions that posted after the month's last heartbeat (late card
charges, bill adjustments) only enter the closed month here.

**Pending transactions in a closed month are an error.** A settled month must contain only
`posted` rows. `/fetch` prints `PENDING credit transactions remaining: N`. If `N > 0`, first
**run `/fetch` again** for `{month}` to pull the real POSTED versions (fetch drops the stale
PENDING ghosts each time); repeat up to ~3 times until the count stops dropping. Then
`audit.mjs --final` enforces the invariant: any row still `pending` (Pluggy lagged or dropped
it) is flagged `PENDING_IN_CLOSED_MONTH` and normalized to `posted`. Audit prints each row it
flips — review them, since a flipped row that Pluggy no longer returns may need removing via a
fresh `/fetch` reconciliation.

If `/recompile` prints any `unclassified` rows, run `/classify` on them and recompile again
(still with `--final`) before auditing — the closed month should be fully classified.

## 2. Heartbeat the current month

If the settled month is not the current month, run `/heartbeat` for the current month
(fetch → recompile → classify → audit → advise → notify). That produces and sends the
current-month budget message. If the user settled the current month itself, skip this step.
