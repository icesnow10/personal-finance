---
name: advise
description: Analyze the compiled budget and generate actionable insights in a fixed, repeatable pattern for Telegram and human review. Use when any skill needs insights after budget generation, or when the user asks for advice or analysis on their budget.
---

# Advise - Budget Insights

Analyzes a compiled budget and generates insights in a strict, reusable pattern. Called by any skill that produces a budget, such as `/compile`, `/heartbeat`, or `/settle`.

## Input

- The compiled month budget
- The previous month's budget, when available

## Required Delivery Pattern

The skill must always generate the same section order and section labels.

Use this exact pattern:

```text
📊 Budget {Mes} {Ano}{partial_tag}

💰 Receita: R$ {income}
💸 Despesas: R$ {expenses}
📈 Saldo: R$ {net}

Orçamento por bucket:
{emoji} Custos Fixos: {actual_pct}% — R$ {spent} de R$ {limit} ({bucket_tail})
{emoji} Conforto: {actual_pct}% — R$ {spent} de R$ {limit} ({bucket_tail})
{emoji} Lib. Financeira: {actual_pct}% — R$ {available_to_invest} disponíveis p/ investir (o que não foi gasto vira liberdade financeira)

💬 Momentum:
{momentum_text}

🔎 Top 10 Categorias (vs {MesAnterior}):
1. {categoria}: R$ {valor} ({variacao})
2. ...

🏆 Destaques:
* ...

⚠️ Fique de olho:
* ...

💡 Recomendações:
* ...

❓ Não categorizados: {count} transações
* {description} — R$ {amount} ({date})
* ...
```

Rules for this pattern:
- Always keep this section order.
- Always use these section titles exactly.
- Always return all sections, even if some sections are short.
- If there are fewer than 10 categories, return all available categories.
- `Momentum` must be 1-2 sentences only.
- `Destaques`, `Fique de olho`, and `Recomendações` should each contain 2-5 bullets when data supports it.
- The text must be ready to send by Telegram without extra rewriting.

## Analysis Logic

### 1. Header block

Build:
- `Budget {Mes} {Ano}`
- append `{partial_tag}` as ` (parcial até DD/MM)` when the month is partial

### 2. Main totals

Always compute and show:
- Receita
- Despesas
- Saldo

Use rounded BRL formatting for display.

### 3. Buckets

For each bucket compute:
- actual percentage of income
- target amount in BRL
- actual spent amount in BRL
- remaining amount in BRL when applicable

Statuses:
- `green`: within 3 percentage points of target
- `yellow`: between 3 and 7 percentage points away from target
- `red`: more than 7 percentage points away from target

Bucket emojis:
- `✅` for green
- `⚠️` for yellow
- `🔴` for red

Bucket line rules:
- Custos Fixos and Conforto use `R$ {spent} de R$ {limit}` and then:
  - `sobra R$ X` when under target
  - `acima R$ X` when over target
- Liberdade Financeira should never talk about `sobra`.
- Liberdade Financeira should describe how much is available to invest, because what is not spent becomes freedom bucket.

### 4. Momentum

Write a short advisor-style reading of the month.

Must combine:
- whether the month is calm, pressured, or off-track
- whether spending is mostly installments or new spending
- which bucket deserves immediate attention
- whether salaries are actual or still provisioned

Do not write a generic summary. It must mention concrete conditions from the month.

### 5. Top 10 Categories

Rank categories by current month amount descending and compare against previous month.

For each category:
- show current amount
- compare with previous month using one of:
  - `▲X% · +R$ Y`
  - `▼X% · -R$ Y`
  - `→ estável`
  - `{mes anterior}: R$ Y` when current month is zero and previous month was meaningful
- when reimbursements dominate and the category is negative, explain that clearly, for example:
  - `Saúde: -R$ 1.574 (reembolsos > gastos)`

Rules:
- Exclude internal transfers, skipped rows, Troco Turbo auto-movements, and intentional investment applications.
- Use friendly pt-BR category names.
- For partial months, compare against the previous month but keep wording honest that current month is still partial when relevant.

### 6. Destaques

Highlight wins such as:
- reimbursements received
- category reductions
- fewer extras than previous month
- positive net
- 100% categorized rows
- buckets at or better than plan

Do not praise routine internal transfers or hidden technical artifacts.

### 7. Fique de olho

Flag risks such as:
- low remaining margin in Conforto or Custos Fixos
- salaries still provisioned
- previous month had non-recurring extra income
- high concentration in one category
- many uncategorized rows
- current pace likely to compress the rest of the month

### 8. Recomendações

Generate direct next actions, not generic advice.

Examples:
- control new discretionary spending in Conforto
- monitor reimbursements still expected
- cap daily new spending for remaining days
- review a specific category if it is accelerating

### 9. Não categorizados

Count all rows with `"type": "unclassified"` in the compiled budget.

- Show the total count.
- List up to 5 examples with `description`, `amount`, and `date`.
- If there are zero uncategorized rows, show `❓ Não categorizados: 0 — tudo classificado!` and skip the examples.
- If there are more than 5, show 5 and append `... e mais {N} transações`.

## Tone and Language

- All user-facing text must be in pt-BR.
- Sound like a helpful advisor, not a dashboard dump.
- Always include R$ amounts alongside percentages when useful.
- Avoid internal keys and technical jargon.
- Treat reimbursements as reimbursements, not as bizarre negative spending.
- Distinguish installments from new spending when relevant.
- Be concrete and readable.

## Output

Return only the final formatted advisory text.

- Do not write any file.
- Do not emit JSON.
- Do not return a structured object.
- The output is the final message itself, ready for Telegram or direct display.
- If another skill needs to send the advice, it should pass this formatted text through directly.

## Rules

- The final response must always follow the fixed delivery pattern above.
- Compare with previous month when available.
- For partial months, emphasize pace, margin, and what is still provisioned.
- For complete months, emphasize final outcome and savings quality.
