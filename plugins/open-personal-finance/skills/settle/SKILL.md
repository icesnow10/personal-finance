---
name: settle
description: Finalize a target month — always refetch it fresh to confirm the movements are complete (all transactions present, no pending left), then recompile with --final to strip provisionals, and run heartbeat for the current month. Defaults to settling the previous month.
---

# Settle

Closes a target month, then updates the current one.

`{month}` is the month the user wants to settle (`YYYY-MM`). If the user does not specify
one, default to the **previous** month.

## 1. Refetch and confirm the month is complete

**Always start with a fresh `/fetch`** for `{month}` — even if a heartbeat ran moments ago.
Settle's whole job is to prove the month's movements are *complete*, and only a live fetch can
pull what posted after the last heartbeat (late card charges, bill adjustments, refunds). Never
settle off stale on-disk data.

```
node plugins/open-personal-finance/scripts/fetch.mjs --household {h} --month {month}
```

**Completeness has two conditions: every transaction is present AND nothing is left pending.**
`/fetch` prints `PENDING credit transactions remaining: N` — that count is the completeness
signal:

- **`N == 0`** → the card bill has closed and every charge is `posted`. The month's movements
  are complete → finalize it.
- **`N > 0`** → the bill is still open (or Pluggy lagged). The month is **not** complete yet.
  Re-run `/fetch` (each pass drops the stale PENDING ghosts and pulls their POSTED
  replacements); repeat up to ~3× until `N` stops dropping. If `N` is **still > 0** after that,
  **stop and tell the user the month cannot be cleanly settled yet** — a genuinely-open bill
  means finalizing now would lock in incomplete data. Do not force it silently.

Only once the month is complete (or the user explicitly confirms the residual `pending` rows
are Pluggy stragglers, not a still-open bill) run the finalize step:

```
node plugins/open-personal-finance/scripts/recompile.mjs --household {h} --month {month} --final
node plugins/open-personal-finance/scripts/audit.mjs     --household {h} --month {month} --final
```

`recompile --final` strips all provisional rows (a closed month must contain only real
transactions); `audit --final` enforces the invariant: any row still `pending` is flagged
`PENDING_IN_CLOSED_MONTH` and normalized to `posted`. Audit prints each row it flips — review
them, since a flipped row that Pluggy no longer returns may need removing via a fresh `/fetch`
reconciliation.

If `/recompile` prints any `unclassified` rows, run `/classify` on them and recompile again
(still with `--final`) before auditing — the closed month should be fully classified.

## 2. Heartbeat the current month

If the settled month is not the current month, run `/heartbeat` for the current month
(fetch → recompile → classify → audit → advise → notify). That produces and sends the
current-month budget message. If the user settled the current month itself, skip this step.
