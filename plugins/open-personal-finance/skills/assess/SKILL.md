---
name: assess
description: Assess a household's monthly investment snapshot for real anomalies. A script produces an objective month-over-month diff (value + quantity per holding, tagged qty/price/new/gone, plus integrity checks); then you reason over it and write a plain-language verdict — a summary message, an assess_{month}.md, and an assess_{month}.json (per-item, consumed by the viewer). Called at the end of /investments; also use whenever the user asks to review, sanity-check, validate, or "assess" a month's investments/portfolio/patrimônio, or whether anything looks unusual, missing, or wrong.
---

# Assess (investments — real insight, not thresholds)

Two steps: a script gathers **facts**, then **you judge them**. Magnitude of a price move is not
insight — a stock drifting is normal. What matters is a *real action*, a *structural change*, or a
*data error*. Never emit a finding just because a number moved.

## 1 — Produce the facts

```
node plugins/open-personal-finance/scripts/assess.mjs --household {h} --month {YYYY-MM} --resources .
```

Writes `…/{month}/investments/result/assess_facts_{month}.json` (baseline = latest earlier month;
override with `--prev`). Read that file. It contains:

- `totals` — portfolio + by_type + by_broker, current vs baseline, delta/pct.
- `buckets[]` — per **product**: value, `pct` of portfolio, holder split, count, and month-over-month
  (`baseline`, `delta`, `delta_pct`). This is the raw material for the per-area mini-reports.
- `integrity[]` — objective errors: `FX_OUT_OF_BAND`, `FX_SPLIT` (>1 rate in a month), `DUPLICATE`,
  `VALUE_MISMATCH` (valor_atual doesn't reconcile to qty×price×rate or price×rate).
- `changes[]` — every holding that moved, each with a **`driver`**:
  - `qty` — the share/unit count changed → a **real action** (buy / sell / transfer). Look here.
  - `price` — count unchanged, only value drifted → **market noise**. Ignore by default.
  - `new` — appeared this month. `candidates[]` = same-holder rows that *vanished* with a similar value.
  - `gone` — disappeared. `candidates[]` = same-holder *new* rows with a similar value.

## 2 — Judge (your job)

Reason holding-by-holding. Decide what a person actually needs to know:

- **`integrity` → always a finding (HIGH).** These are data bugs. Fix the source: correct
  `_positions.json` and re-run `/investments` (which re-runs assess), don't just report them.
- **`gone` + a matching `new` candidate of similar value = a rename/migration**, not lost money
  (e.g. a Nubank caixinha moved into the "Nu Reserva Imediata" fund). Say so; low or no severity.
- **`gone` with no candidate** = a real sale or a missing extraction → worth a look.
- **`new`** = a genuinely new position, or one the prior extraction missed. Note it if material;
  dust (a few reais) usually isn't.
- **`qty`** = someone bought/sold/transferred. Benign if it's a known pattern (RSU vesting, a salary
  sweep); notable if it's large or unexpected.
- **`price`** = ignore — *unless* the asset class shouldn't drift like that (a CDB / Tesouro / cash
  balance falling sharply is suspicious; an equity/RSU moving is not) or the move is extreme with no
  market rationale.
- **`totals.pct`** large with no cause (deposit, withdrawal, a known market swing, a migration) → note it.

Aim for a short list of things that *matter*. "Nothing anomalous — the +7% is RSU vesting + price,
and carol's reserve just migrated vehicles" is the ideal outcome, not a wall of threshold hits.

## 3 — Evaluate the portfolio by area

Beyond anomalies, actually **review the portfolio**. Group `buckets[]` into areas and write a mini-
report for each. Suggested grouping (adapt to what's present):

| Area | Products |
|---|---|
| Reserva de Emergência | `Reserva de Emergência` |
| Renda Fixa | `Renda Fixa`, `Renda Fixa US`, `Tesouro Direto` |
| Fundos Imobiliários | `Fundo Imobiliário` |
| Ações Brasil | `Ações BRA` |
| Ações Exterior | `Ações US` |
| RSU Nubank | `Ações (Vested Nubank)`, `Ações (Vesting Nubank)` |
| Caixa / Disponível | `Disponível para Investir` |
| Cripto / ETF | `ETF` |
| FGTS | `FGTS` |

For each area judge, using the household's context (read `personal_finances_{month}.json` for
holding-level detail): its **size and % of portfolio**, month-over-month, **concentration** (a single
asset or issuer dominating — e.g. RSU in the employer's own stock, one CDB issuer oversized),
**diversification**, **liquidity** (how much sits frozen vs available), **FX exposure** (Exterior),
and whether it looks **adequate** (is the emergency reserve liquid and sensibly sized? is cash idle?).
Give each a `status`: `ok` or `attention`. Don't invent thresholds you can't ground — if you can't
judge adequacy (e.g. reserve vs monthly expenses, which you don't have), say so.

## 4 — Write the outputs

Write all three into `…/{month}/investments/result/`:

**`assess_{month}.json`** (the viewer reads this):
```json
{ "household": "trevo", "month": "2026-06", "baseline": "2026-05",
  "summary": "one plain-language paragraph — the overall verdict",
  "items": [
    { "broker": "...", "holder": "...", "type": "...", "product": "...", "nome": "...",
      "severity": "HIGH|MEDIUM|INFO",
      "kind": "MIGRATION|SOLD|NEW|UNEXPLAINED_DROP|DATA_ERROR|...",
      "message": "why this deserves attention (or why it's benign but worth noting)" }
  ],
  "sections": [
    { "area": "RSU Nubank", "products": ["Ações (Vested Nubank)", "Ações (Vesting Nubank)"],
      "value": 704425.35, "pct": 32.4, "status": "ok|attention",
      "verdict": "one line", "notes": "the mini-report — size, MoM, concentration, liquidity, etc." }
  ],
  "global": [ { "severity": "...", "kind": "CONCENTRATION|LIQUIDITY|...", "message": "portfolio-level note" } ] }
```
`items` = per-holding anomaly badges (only holdings that deserve one — empty is a fine result).
`sections` = the per-area review (always write these). `global` = macro attention points. `severity`/
`status` are *your judgment*, not thresholds. The viewer rolls `items` up to per-product badges and
opens a modal with this info on any point of attention.

**`assess_{month}.md`** — the full review: the verdict paragraph; then **one mini-report section per
area**; then the anomalies with your reasoning; then a one-line note on what you deliberately
dismissed (the price drift) so it's clear you looked at everything.

**summary message** — relay one or two sentences to the user (the same as `summary`).

## Notes

- `--strict` makes the script exit non-zero if any `integrity` issue exists (objective only) — use
  it when gating a pipeline.
- Identity is `broker | holder | type | product | nome`. The viewer matches items to rows by these
  five fields, so copy them verbatim from the facts.
