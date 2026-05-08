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

The skill must **always send two separate Telegram messages** in this order:

1. **Leftover preamble** — short opener focused on what is still available to spend.
2. **Full advisory** — the structured budget breakdown.

The two messages are sent as independent `/notify` calls. Do not concatenate them.

### Message 1 — Leftover preamble

```text
💚 R$ {leftover_total} ainda disponíveis pra gastar este mês

🔵 Custos Fixos: R$ {cf_remaining} de folga
🟠 Conforto: R$ {co_remaining} de folga
🟢 Liberdade Financeira: cada R$ não gasto vira investimento (hoje +R$ {lf_above_target} acima do alvo)

Quanto menos do leftover você usar, mais engorda a Liberdade Financeira.
```

Rules for the preamble:
- `{leftover_total}` = sum of `(target − spent)` for Custos Fixos and Conforto, considering only positive remainders. Liberdade is **not** included in leftover — it is the destination, not a budget to spend.
- If a bucket is already over target, show `R$ X acima` instead of `R$ Y de folga` for that line.
- `{lf_above_target}` is positive when current Liberdade % exceeds 45% target. If under, show `R$ X abaixo do alvo` instead.
- Keep this message short. It is the headline.

### Message 2 — Full advisory

```text
📊 Budget {Mes} {Ano}{partial_tag}

💰 Receita: R$ {income}
💸 Despesas: R$ {expenses_real} (+ R$ {expenses_prov} prov. = R$ {expenses_total})
📈 Saldo: R$ {net}

Orçamento por bucket:
{emoji} Custos Fixos: {actual_pct}% — R$ {spent} (+R$ {prov} prov.) de R$ {limit} ({bucket_tail})
{emoji} Conforto: {actual_pct}% — R$ {spent} (+R$ {prov} prov.) de R$ {limit} ({bucket_tail})
{emoji} Lib. Financeira: {actual_pct}% — R$ {available_to_invest} disponíveis p/ investir (o que não foi gasto vira liberdade financeira)

💬 Momentum:
{momentum_text}

🔎 Top 10 Categorias (vs {MesAnterior}):
1. {bucket_emoji} {categoria}: R$ {valor} ({variacao})
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

Rules for the full advisory:
- Always keep this section order.
- Always use these section titles exactly.
- Always return all sections, even if some sections are short.
- If there are fewer than 10 categories, return all available categories.
- `Momentum` must be 1-2 sentences only.
- `Destaques`, `Fique de olho`, and `Recomendações` should each contain 2-5 bullets when data supports it.
- The text must be ready to send by Telegram without extra rewriting.
- If `expenses_prov` is zero, omit the `(+ R$ X prov. = R$ Y)` suffix on the Despesas line. Same rule applies per bucket: omit `(+R$ X prov.)` when zero.

### Top 10 — bucket emoji prefix

Every Top 10 line starts with the emoji of the category's bucket:

| Bucket | Emoji |
|---|---|
| `custos_fixos` | 🔵 |
| `conforto` | 🟠 |
| `liberdade_financeira` | 🟢 |

Example: `1. 🔵 Housing: R$ 7.171,84 (▲6% · +R$ 412)`

## Analysis Logic

### 1. Header block

Build:
- `Budget {Mes} {Ano}`
- append `{partial_tag}` as ` (parcial até DD/MM)` when the month is partial

### 2. Main totals

Always compute and show:
- Receita
- Despesas — format as `R$ {real} (+ R$ {prov} prov. = R$ {total})` when provisional expenses exist; if zero, show only `R$ {real}`.
- Saldo

Use rounded BRL formatting for display.

### 3. Buckets

For each bucket compute:
- actual percentage of income (real + provisioned, since the % is what informs the bucket emoji)
- target amount in BRL
- actual spent amount in BRL (real, non-provisional)
- provisioned amount in BRL for this bucket (sum of `provisional: true` rows in the bucket)
- remaining amount in BRL when applicable

The bucket line shows real and provisioned amounts side by side so the user understands what is already locked in vs estimated.

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

Highlight wins that the user would not see at a glance. Look for:
- reimbursements received that materially reduced a category
- categories that dropped meaningfully vs prior month after a known cost
- subscriptions that were cancelled / not billed this month
- installment series that just finished (one fewer recurring CC line going forward)
- one-time costs from prior month that did not repeat
- buckets running materially under target with no impending big expense

**Avoid trivial / always-true praise.** Do not list "X% categorizado", "saldo positivo", "bucket dentro do alvo" without context. Do not call out salary arrival or routine paycheck.

### 7. Fique de olho

Flag non-obvious risks that the user would miss reading the dashboard. Prefer deep, specific lookouts. Look for:
- installment series with many parcels remaining (e.g. "Rio Sul 4/5 — R$ 579/mês até setembro, total restante R$ 1.158")
- recurring vendor whose value jumped vs prior months (utilities, condo reajuste, internet plan creep)
- merchant concentration: a single vendor representing >15% of a bucket
- foreign-currency charges that ballooned vs typical FX
- new merchant appearing for the first time with material amount
- pace projection: at current daily run-rate, which bucket would breach by month-end
- annual / non-monthly subscriptions about to renew
- reimbursements expected but not yet received (e.g. CARE PLUS, Venâncio) and their estimated value
- category that quietly grew across the last 2-3 months without being noticed

**Do not** flag salary still provisioned, do not flag uncategorized rows count, do not flag generic "watch discretionary".

### 8. Recomendações

Direct, specific actions tied to a number or a named transaction. Examples of the **right level of depth**:

- "Cancelar Crunchyroll antes de 10/06 — R$ 178,90/mês com baixo uso comparado ao Apple TV+"
- "Compras parceladas no Rio Sul totalizam R$ 1.158 restantes — evitar nova compra parcelada lá enquanto não fecha"
- "Conta Vivo pulou de R$ 280 para R$ 320,93 — verificar se foi reajuste contratual ou serviço extra"
- "Reembolso Care Plus pendente estimado em R$ 1.200 — cobrar até o fim do mês"

**Do not** recommend: "classify pending transactions", "wait for salary", "limit discretionary spending", or any generic budgeting platitude.

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

Return the two formatted message bodies (preamble + full advisory) as plain text.

- Do not write any file.
- Do not emit JSON.
- Do not return a structured object.
- After generating both messages, call `/notify` **twice** — first with the leftover preamble, then with the full advisory. Do not concatenate them into a single message. Do not skip either notification even if there were no changes — the user always wants to receive the current budget status.

## Rules

- The final response must always follow the fixed delivery pattern above.
- Compare with previous month when available.
- For partial months, emphasize pace, margin, and what is still provisioned.
- For complete months, emphasize final outcome and savings quality.
