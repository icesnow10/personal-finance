---
name: advise
description: Generate the two Telegram budget messages (leftover preamble + full advisory) from a compiled budget. Use when /compile, /heartbeat, or /settle need insights, or when the user asks for advice/analysis on their budget.
---

# Advise

Run the bundled script — it computes all totals deterministically and writes the two
messages to `result/_advise_msg1.txt` and `_advise_msg2.txt`:

```
node plugins/open-personal-finance/scripts/advise.mjs --household {household} --month {YYYY-MM}
```

The script produces, in pt-BR and ready to send:

1. **Message 1 — leftover preamble:** what's still available in Custos Fixos / Conforto
   (Liberdade is the destination, never "leftover").
2. **Message 2 — full advisory:** Receita / Despesas / Saldo, the three bucket lines
   (✅/⚠️/🔴 by distance from 25/30/45% targets), Top 10 categories vs the previous month,
   and data-driven Destaques / Fique de olho / Recomendações / Não categorizados.

## Optional: sharpen the insights

The script's narrative bullets are data-driven but generic. Before notifying you MAY edit
the `⚠️ Fique de olho` / `💡 Recomendações` sections of `_advise_msg2.txt` in place to add
non-obvious, number-specific insight (an installment series finishing, a vendor whose value
jumped, a reimbursement still pending). Keep the section titles and order. Do **not** add
trivial praise (e.g. "X% categorizado", "salário chegou") and do not flag the unclassified
count as a risk.

## Then notify

```
node plugins/open-personal-finance/scripts/notify.mjs --household {household} --month {YYYY-MM}
```

Sends both messages as two separate Telegram messages. Do not call `/notify` again
elsewhere in the same run.
