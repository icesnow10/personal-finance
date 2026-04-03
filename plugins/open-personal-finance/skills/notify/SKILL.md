---
name: notify
description: Send budget insights and alerts via Telegram. Reads TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID from .env.local. Called by /compile after /advise generates insights. Skips silently if Telegram is not configured. Use when the user asks to send notifications or when /compile triggers it.
---

# Notify — Telegram Notifications

Sends budget insights and alerts to the user's Telegram via a bot. Called automatically by `/compile` after `/advise`.

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
💸 Despesa: R$ {expenses}
📈 Saldo: R$ {net}

*Buckets:*
{bucket_emoji} Custos Fixos: {actual_pct}% (meta {target_pct}%)
{bucket_emoji} Conforto: {actual_pct}% (meta {target_pct}%)
{bucket_emoji} Liberdade Financeira: {actual_pct}% (meta {target_pct}%)

{recommendations}
```

Where:
- `{partial_tag}` = ` (parcial ate {date})` if partial, empty if complete
- `{bucket_emoji}` = ✅ if green, ⚠️ if yellow, 🔴 if red (from `/advise` health check)

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
