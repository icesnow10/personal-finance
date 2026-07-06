# Canonical budget schema

Source of truth: the closed months `budget_jan_2026 … budget_may_2026`. Every month —
including the current one — must follow this shape. The reusable scripts in `scripts/`
produce it; `scripts/audit.mjs` validates it.

## File

`resources/{household}/{YYYY-MM}/expenses/result/budget_{mmm}_{YYYY}.json`

A **flat top-level JSON array** of row objects (no wrapper). `{mmm}` is the lowercase
English 3-letter month (`jan,feb,mar,apr,may,jun,jul,aug,sep,oct,nov,dec`).

## Row

| Field | Type | Notes |
|---|---|---|
| `id` | string | Pluggy transaction id (or `manual:…` / `manual-income:…` for provisionals) |
| `date` | `YYYY-MM-DD` | **Raw Pluggy date, no treatment.** Required on non-provisional rows |
| `description` | string | Opaque transfers enriched with `\|<counterparty>`; audit appends `(Category - Subcategory)` |
| `holder` | string | First name lowercased (`michel`, `carol`) |
| `bank` | string | `Nubank`, `Wise`, … |
| `account_number` | string | Last digits; must exist in `pluggy_items.json` |
| `source` | string | `Credit Card`, `Savings Account`, `Nubank Savings`, `Wise USD` |
| `provisional` | boolean | `true` only for forecast rows; closed months are all `false` |
| `status` | enum | `posted` \| `pending`. Credit charges are `pending` while the bill is open, `posted` once it closes; bank rows are always `posted`. Derived from Pluggy status by `fetch`/`recompile` |
| `type` | enum | `expense` \| `income` \| `skipped` \| `unclassified` |
| `amount` | number | BRL. Expenses positive; BANK debits sign-flipped; refunds negative |
| `bucket` | enum/null | `custos_fixos` \| `conforto` \| `liberdade_financeira`; null for income/skipped |
| `category` | string/null | One category → exactly one bucket (see map below) |
| `subcategory` | string/null | Required on expenses |
| `installmentNumber` | int | **Only on parcels.** Parsed from `n/total` in the description |
| `totalInstallments` | int | **Only on parcels** (≥ 2). The viewer's Parcelas card reads these fields |

## category → bucket (0 conflicts across jan–may)

- **custos_fixos:** Housing, Health, Insurance, Groceries, Transportation, Wellness
- **conforto:** Subscriptions, Personal Care, Services, Food/Dining, Recreation, Shopping, Travel, Family Support, Education
- **liberdade_financeira:** Investment (Troco Turbo)

Invariant: a `(category, subcategory)` pair must use **one** bucket everywhere. `audit.mjs` flags/fixes violations.

## Gotchas

- **Installment fields are mandatory on parcels** — without `installmentNumber`/`totalInstallments` the viewer's Parcelas card disappears for the month.
- **Open credit-card bill** lists the whole cycle's installments with future scheduled dates; include them all (don't filter by date). By `/settle` they will have posted.
- A new month's first Pluggy fetch can be incomplete — re-run `/fetch` if a fresh month returns suspiciously few card rows.
- **Pending ghosts:** when a bill closes, Pluggy re-issues each charge as `posted` under a NEW id, so the old `pending` copy would linger as a duplicate. `fetch` drops any `pending` credit row that a `posted` row already supersedes (same card/description/amount/date). `/settle` re-fetches while `PENDING credit transactions remaining` stays above 0.
- **No pending in a closed month:** a settled month must be all `posted`. `audit.mjs --final` (run by `/settle`) flags any leftover `pending` row (`PENDING_IN_CLOSED_MONTH`) and normalizes it to `posted`. A row that stays pending after re-fetch is usually one Pluggy dropped from its feed while our additive merge kept it — audit prints each one it flips so you can reconcile/remove if needed.
