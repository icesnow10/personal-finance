---
name: notify
description: Send the prepared budget messages to Telegram. Reads TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID from .env.local and skips silently if not configured. Use when any skill needs to send notifications after /advise, or when the user asks to send notifications.
---

# Notify

Run the bundled script — it sends `result/_advise_msg1.txt` and `_advise_msg2.txt` (written
by `/advise`) as two separate Telegram messages:

```
node plugins/open-personal-finance/scripts/notify.mjs --household {household} --month {YYYY-MM}
```

## Rules

- Credentials come from `{household}/.env.local` (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`).
  If either is missing, the script skips silently — Telegram is optional.
- Always send when configured; the user always wants the current status.
- `/advise` already calls this — do not also call it separately in the same run.
- For ad-hoc one-off messages (e.g. a `/settle` close line or a classification-update
  follow-up), write the text to a file and send it, or extend the message files before
  running the script. Keep each message under 4096 characters.
