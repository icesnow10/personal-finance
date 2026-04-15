---
name: notify
description: Send budget insights and alerts via Telegram. Reads TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID from .env.local. Skips silently if Telegram is not configured. Use when any skill needs to send notifications after /advise, or when the user asks to send notifications.
---

# Notify - Telegram Notifications

Sends budget insights and alerts to the user's Telegram via a bot. Called by any skill that runs `/advise`, such as `/compile`, `/heartbeat`, or `/settle`.

## Prerequisites

Requires these variables in `.env.local` at the project root or `resources/.env.local`:

```text
TELEGRAM_BOT_TOKEN=<bot-token-from-botfather>
TELEGRAM_CHAT_ID=<user-chat-id>
```

If either variable is missing, skip silently. Telegram is optional.

## How to Send

Use `node -e` with the HTTPS module, with no external dependencies:

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

Read credentials from `.env.local`.

## Message Templates

### After /compile

Preferred behavior:
- If `/advise` already returned a fully formatted `summary` string in the fixed monthly delivery pattern, use that string directly as the Telegram message body.
- Only rebuild the message from fields when that formatted `summary` is missing.

Fallback template:

```text
📊 *Budget {month} {year}*{partial_tag}

💰 Receita: R$ {income}
💸 Despesas: R$ {expenses}
📈 Saldo: R$ {net}

*Orçamento por bucket:*
{bucket_emoji} *Custos Fixos*: {actual_pct}% — R$ {spent} de R$ {limit} ({bucket_tail})
{bucket_emoji} *Conforto*: {actual_pct}% — R$ {spent} de R$ {limit} ({bucket_tail})
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
- `{partial_tag}` = ` (parcial até {date})` if partial, otherwise empty
- `{bucket_emoji}` = `✅`, `⚠️`, or `🔴` from `/advise.health`
- `{bucket_tail}` = `sobra R$ X` when under target or `acima R$ X` when over target
- `{accumulated}` = amount available to invest in Liberdade Financeira
- `{momentum_summary}` = short text from `/advise`
- `{category_deep_dive_table}` = one line per category
- `{wins}`, `{alerts}`, and `{recommendations}` = bullet lists from `/advise`

### After /heartbeat

```text
🫀 *Heartbeat {date}*

+{new_count} transações novas (+R$ {new_amount})
💸 Despesa total: R$ {expenses}
📉 Ritmo diário: R$ {daily_avg}/dia

{top_warning_if_any}
```

### After /settle

```text
🔒 *{month} fechado*

💰 Receita: R$ {income}
💸 Despesa: R$ {expenses}
📈 Saldo final: R$ {net}
🏦 Taxa de poupança: {savings_pct}%

{top_win} | {top_warning}
```

## Rules

- Always send the notification when Telegram is configured. Do not skip based on whether there were changes — the user always wants to receive the current status.
- Skip silently only if `TELEGRAM_BOT_TOKEN` or `TELEGRAM_CHAT_ID` is not set.
- Keep messages under 4096 characters.
- Use Markdown parse mode.
- Do not send sensitive merchant-level details.
- If the Telegram API returns an error, log it but do not fail the parent skill.
- The caller passes the data. `/notify` only formats and sends.
