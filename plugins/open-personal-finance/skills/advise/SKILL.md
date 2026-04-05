---
name: advise
description: Analyze the compiled budget and generate actionable insights. Compares actuals vs targets, flags problem categories, highlights wins, and provides recommendations. Use when any skill needs insights after budget generation, or when the user asks for advice/analysis on their budget.
---

# Advise — Budget Insights

Analyzes a compiled budget and generates actionable insights. Called by any skill that produces a budget (e.g. `/compile`, `/heartbeat`, `/settle`).

## Input

The compiled budget JSON for the target month, plus the previous month's budget (if available) for comparison.

## Analysis

### 1. Budget health check — Buckets with amounts

Compare actual bucket percentages against targets. For each bucket compute:
- **Limite**: the target amount in R$ (target_pct × total_income)
- **Gasto**: the actual amount spent in R$
- **Disponível**: Limite − Gasto (how much is left to spend)

| Bucket | Target | Status |
|---|---|---|
| Custos Fixos | 30% | On track / Over by X pp / Under by X pp |
| Conforto | 25% | On track / Over by X pp / Under by X pp |
| Liberdade Financeira | 45% | On track / Over by X pp / Under by X pp |

Thresholds:
- **Green**: within ±3pp of target
- **Yellow**: 3-7pp off target
- **Red**: >7pp off target

### 2. Category spotlight

Identify the top 3 categories that need attention:
- Biggest increase vs previous month (% change)
- Categories consuming the most budget relative to their bucket
- Categories with many uncategorized transactions (data quality risk)

### 3. Income vs pace

For partial months:
- Current spending pace (daily average x days in month) vs total income
- Projected end-of-month net if pace continues
- Days remaining and "safe daily spend" to hit targets

For complete months:
- Actual net vs target (Liberdade Financeira bucket)
- Savings rate achieved

### 4. Momentum

A short, conversational summary of how the month is going — 1-2 sentences max, like a financial advisor giving a quick pulse check. Combine the key signals (trend, biggest movers, installment load, trajectory) into a cohesive narrative instead of listing bullet points.

Example: "Mês começando bem — gastos concentrados em parcelas já previstas, sem surpresas. Atenção ao bucket de Conforto que já está 86% comprometido com apenas 3 dias."

Use the following data points to compose the summary (do NOT list them as bullets):
- Trend vs previous month
- Top category movers
- Installment share vs new spending
- Savings trajectory and outlook

### 5. Category deep dive — Top 10

Rank the top 10 categories by amount spent (descending) and compare each with the previous month:

For each category include:
- **Rank** (1-10 by current month spend)
- **Category name**
- **Current amount** (R$)
- **Previous month amount** (R$) — if no previous month, show "—"
- **Delta** (R$ and %) — positive = spending increased, negative = decreased
- **Bucket** it belongs to (Custos Fixos, Conforto, or Liberdade Financeira)
- **Note** (optional): brief context — e.g., "maioria parcelas", "inclui reembolso de R$ X", "gasto novo"

Rules for this section:
- Always include exactly 10 categories (or all if fewer than 10 exist)
- Sort by current month amount descending
- Use friendly category names (not internal keys)
- **Exclude investment categories** (Investment/Troco Turbo, RDB applications, intentional investments) — these are already reflected in the Liberdade Financeira bucket and are intentional decisions, not expenses to track
- If a category has reimbursements, show the net amount and mention the reembolso in the note
- For partial months, add context that amounts are partial

### 6. Wins and alerts

**Wins** (positive highlights):
- Categories that decreased vs previous month
- Buckets on or under target
- Savings rate above target
- Reimbursements received (e.g., "Recebeu R$ X em reembolsos de Saúde" — NOT "Saúde negativa")
- Do NOT highlight investment applications (RDB, Troco Turbo) as wins — they are intentional decisions already visible in Liberdade Financeira

**Alerts** (things to watch):
- Categories with >30% month-over-month increase
- Buckets over target
- High uncategorized count (>10 items)
- Spending pace exceeding income projection

### 7. Actionable recommendations

Generate 2-3 specific, actionable recommendations based on the data:
- "Moradia 2pp acima da meta — verificar se alta na conta de luz foi pontual"
- "Alimentação +45% — considerar planejamento de refeições na próxima semana"
- "Caminho para 48% em Liberdade Financeira — acima da meta de 45%"

## Tone and language guidelines

The insights are for a real person checking their finances. Write like a helpful financial advisor, not a robot:

- **Avoid jargon and internal terms**: Do not expose internal category keys like "Troco Turbo" or "Investment (Troco Turbo)". RDB/caixinha applications are skipped from expenses entirely — they are internal transfers, not investments or expenses. Only reference explicit investments (ações, Tesouro, fundos) when they exist.
- **Frame positively when possible**: Instead of "Saúde negativa", say "Reembolsos de saúde: recebeu R$ X de volta". Negative amounts from reimbursements are a win, not something alarming.
- **Use friendly language**: "Seu ritmo de gasto está saudável" > "Pace within acceptable range"
- **Be specific with money**: Always include R$ amounts alongside percentages. "Conforto em 21% (R$ 4.200 de R$ 5.000)" is more useful than just "21%".
- **Contextualize installments**: Most credit card expenses are pre-committed installments. When mentioning categories, distinguish between new spending and parcelas when relevant.
- **Portuguese (pt-BR)**: All user-facing text (wins, alerts, recommendations, summary, momentum) must be in pt-BR.

## Output

### Filename

Save to `resources/{household}/{YYYY-MM}/expenses/result/` with a **timestamped filename**:

```
insights_{month}_{year}_{YYYYMMDD}T{HHmmss}.json
```

Example: `insights_apr_2026_20260403T143022.json`

Use the current local date/time at the moment of generation.

### JSON structure

Return a structured insights object. The `generated_at` field **must** be an ISO 8601 timestamp with the current local date and time (not just the date):

```json
{
  "generated_at": "2026-04-03T14:30:22-03:00",
  "month": "2026-04",
  "partial": true,
  "data_through": "2026-04-03",
  "health": {
    "custos_fixos": {
      "status": "green|yellow|red",
      "actual_pct": 0,
      "target_pct": 30,
      "delta_pp": 0,
      "limit_amount": 0,
      "spent_amount": 0,
      "available_amount": 0
    },
    "conforto": {
      "status": "green|yellow|red",
      "actual_pct": 0,
      "target_pct": 25,
      "delta_pp": 0,
      "limit_amount": 0,
      "spent_amount": 0,
      "available_amount": 0
    },
    "liberdade_financeira": {
      "status": "green|yellow|red",
      "actual_pct": 0,
      "target_pct": 45,
      "delta_pp": 0,
      "limit_amount": 0,
      "spent_amount": 0,
      "available_amount": 0
    }
  },
  "spotlight": [
    { "category": "...", "reason": "...", "amount": 0, "change_pct": 0 }
  ],
  "momentum": {
    "expense_trend": { "direction": "up|down|stable", "delta_amount": 0, "delta_pct": 0 },
    "top_movers": [
      { "category": "...", "direction": "up|down", "delta_amount": 0, "delta_pct": 0 }
    ],
    "installment_share": { "amount": 0, "pct_of_expenses": 0 },
    "savings_trajectory": "..."
  },
  "category_deep_dive": [
    {
      "rank": 1,
      "category": "Shopping",
      "amount": 4486.77,
      "prev_amount": 8068.00,
      "delta_amount": -3581.23,
      "delta_pct": -44.4,
      "bucket": "Conforto",
      "note": "Maioria parcelas de CC — sem compras novas"
    }
  ],
  "pace": {
    "daily_avg": 0,
    "projected_total": 0,
    "safe_daily_spend": 0,
    "days_remaining": 0
  },
  "wins": ["..."],
  "alerts": ["..."],
  "recommendations": ["..."],
  "summary": "Plain-text summary for Telegram (see notify template)"
}
```

## Rules

- Be specific — reference actual category names and R$ amounts
- Compare with previous month when available
- For partial months, frame insights around pace and projection
- For complete months, frame insights around final results
- Keep recommendations actionable and non-judgmental
- Follow the tone guidelines above — no jargon, friendly, amounts always present
- The summary field feeds into the `/notify` Telegram template
