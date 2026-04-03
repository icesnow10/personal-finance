---
name: advise
description: Analyze the compiled budget and generate actionable insights. Compares actuals vs targets, flags problem categories, highlights wins, and provides recommendations. Called by /compile after budget generation. Use when the user asks for insights, advice, or analysis on their budget.
---

# Advise — Budget Insights

Analyzes a compiled budget and generates actionable insights. Called automatically by `/compile` after budget generation.

## Input

The compiled budget JSON for the target month, plus the previous month's budget (if available) for comparison.

## Analysis

### 1. Budget health check

Compare actual bucket percentages against targets:

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

### 4. Wins and warnings

**Wins** (positive highlights):
- Categories that decreased vs previous month
- Buckets on or under target
- Savings rate above target

**Warnings** (things to watch):
- Categories with >30% month-over-month increase
- Buckets over target
- High uncategorized count (>10 items)
- Spending pace exceeding income projection

### 5. Actionable recommendations

Generate 2-3 specific, actionable recommendations based on the data:
- "Housing is 2pp over target — check if the utility spike was one-time or recurring"
- "Food/Dining up 45% — consider meal planning next week"
- "On track for 48% Liberdade Financeira — above your 45% goal"

## Output

Return a structured insights object:

```json
{
  "health": {
    "custos_fixos": { "status": "green|yellow|red", "actual_pct": 0, "delta_pp": 0 },
    "conforto": { "status": "green|yellow|red", "actual_pct": 0, "delta_pp": 0 },
    "liberdade_financeira": { "status": "green|yellow|red", "actual_pct": 0, "delta_pp": 0 }
  },
  "spotlight": [
    { "category": "...", "reason": "...", "amount": 0, "change_pct": 0 }
  ],
  "pace": {
    "daily_avg": 0,
    "projected_total": 0,
    "safe_daily_spend": 0,
    "days_remaining": 0
  },
  "wins": ["..."],
  "warnings": ["..."],
  "recommendations": ["..."],
  "summary": "One paragraph plain-text summary for Telegram"
}
```

Also generate a **plain-text summary** (max 500 chars) suitable for Telegram notification.

## Rules

- Be specific — reference actual category names and amounts
- Compare with previous month when available
- For partial months, frame insights around pace and projection
- For complete months, frame insights around final results
- Keep recommendations actionable and non-judgmental
- The summary field must be concise enough for a Telegram message
