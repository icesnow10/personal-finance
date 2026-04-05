---
name: notify
description: Send budget insights and alerts via Telegram. Reads TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID from .env.local. Skips silently if Telegram is not configured. Use when any skill needs to send notifications after /advise, or when the user asks to send notifications.
---

# Notify — Telegram Notifications

Sends budget insights and alerts to the user's Telegram via a bot. Called by any skill that runs `/advise` (e.g. `/compile`, `/heartbeat`, `/settle`).

## Prerequisites

Requires these variables in `.env.local` (at the project root or `resources/.env.local`):

```
TELEGRAM_BOT_TOKEN=<bot-token-from-botfather>
TELEGRAM_CHAT_ID=<user-chat-id>
```

**If either variable is missing, skip silently** — do not error, do not prompt. Telegram is optional.

## How to Send

Use `node -e` with the HTTPS module (no external dependencies):

```javascript
const https = require('https');
const data = JSON.stringify({ chat_id: CHAT_ID, text: MESSAGE, parse_mode: 'Markdown' });
const req = https.request({
  hostname: 'api.telegram.org',
  path: `/bot${TOKEN}/sendMessage`,
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
}, res => { /* handle response */ });
req.write(data);
req.end();
```

Read credentials with `source .env.local` or parse the file in Node.

## Message Templates

### After /compile (monthly budget)

```
📊 *Budget {month} {year}*{partial_tag}

💰 Receita: R$ {income}
💸 Despesas: R$ {expenses}
📈 Saldo: R$ {net}

*Orçamento por bucket:*
{bucket_emoji} *Custos Fixos*: {actual_pct}% — R$ {spent} de R$ {limit} (sobra R$ {available})
{bucket_emoji} *Conforto*: {actual_pct}% — R$ {spent} de R$ {limit} (sobra R$ {available})
{bucket_emoji} *Lib. Financeira*: {actual_pct}% — R$ {accumulated} disponíveis p/ investir (o que não foi gasto vira liberdade financeira)

💬 *Momentum:*
{momentum_summary}

🔎 *Top 10 Categorias:*
{category_deep_dive_table}

🏆 *Destaques:*
{wins}

⚠️ *Fique de olho:*
{alerts}

💡 *Recomendações:*
{recommendations}
```

Where:
- `{partial_tag}` = ` (parcial até {date})` if partial, empty if complete
- `{bucket_emoji}` = ✅ if green, ⚠️ if yellow, 🔴 if red (from `/advise` health check)
- `{spent}`, `{limit}`, `{available}` = R$ amounts from `/advise` health.*.spent_amount, limit_amount, available_amount
- `{accumulated}` = R$ amount from `/advise` health.liberdade_financeira.accumulated_amount — this is Net (income − expenses), the money available to invest
- `{momentum_summary}` = 1-2 sentence conversational summary from `/advise` momentum — like a financial advisor giving a quick pulse check, NOT bullet points
- `{category_deep_dive_table}` = formatted from `/advise` category_deep_dive array, one line per category:
  ```
  1. Shopping: R$ 4.487 (▼44% · -R$ 3.581)
  2. Travel: R$ 3.361 (▼6% · -R$ 230)
  3. Moradia: R$ 2.800 (→ estável)
  ...
  ```
  Use ▲ for increase, ▼ for decrease, → for stable (±5%). Include the note in parentheses if present and adds context.
  If no previous month data, show just the amount without comparison.
- `{wins}` = bullet list from `/advise` wins
- `{alerts}` = bullet list from `/advise` alerts
- `{recommendations}` = bullet list from `/advise` recommendations
- Omit any section that has zero items (e.g., no alerts = skip the alerts block entirely)
- For Liberdade Financeira, "sobra" doesn't apply — this bucket represents savings/investment, so show the amount accumulated instead

### After /heartbeat (incremental update)

```
🫀 *Heartbeat {date}*

+{new_count} transacoes novas (+R$ {new_amount})
💸 Despesa total: R$ {expenses}
📉 Ritmo diario: R$ {daily_avg}/dia

{top_warning_if_any}
```

### After /settle (month closed)

```
🔒 *{month} fechado*

💰 Receita: R$ {income}
💸 Despesa: R$ {expenses}
📈 Saldo final: R$ {net}
🏦 Taxa de poupanca: {savings_pct}%

{top_win} | {top_warning}
```

## Rules

- **Skip silently** if `TELEGRAM_BOT_TOKEN` or `TELEGRAM_CHAT_ID` is not set — never error
- Keep messages under 4096 chars (Telegram limit)
- Use Markdown parse_mode for formatting
- Do not send sensitive details like merchant names — keep it high-level (totals, percentages, category names)
- If the Telegram API returns an error, log it but do not fail the parent skill
- The caller (`/compile`, `/heartbeat`, `/settle`) passes the data — `/notify` just formats and sends
