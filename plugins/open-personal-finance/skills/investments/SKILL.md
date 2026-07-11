---
name: investments
description: Build a household's monthly investment-portfolio snapshot by reading the broker statements (screenshots + PDFs) in investments/input and writing the canonical personal_finances_{YYYY-MM}.json. Use when the user asks to compile, snapshot, update, or generate investments / portfolio / patrimônio / posições for a month, or mentions BTG/Nubank/Wise/FGTS/Morgan Stanley statements under investments/input.
---

# Investments snapshot

Turn the broker statements in `resources/{household}/{YYYY-MM}/investments/input/` into the
flat positions array at `resources/{household}/{YYYY-MM}/investments/result/personal_finances_{YYYY-MM}.json`.

Extraction (reading images/PDFs) is your job — it is not scriptable. The script only
validates the result and writes it in the canonical shape. Reference output:
`resources/trevo/2026-03/investments/result/personal_finances_2026-03.json`.

## Workflow

1. **List inputs.** Glob `…/{YYYY-MM}/investments/input/*`. File names are `{holder}_{source}`
   (e.g. `carol_btg_conta.jpeg`, `michel_etrade.jpeg`, `*_fgts`, `*_nubank_global_eur`).
   Naming varies month to month — map by the holder token + source token, don't assume fixed names.
2. **Get FX rates** — PTAX *venda* for the **last business day of the month**:
   - If `input/` has a cotações CSV, read it. Otherwise fetch BACEN PTAX (WebFetch):
     `https://ptax.bcb.gov.br/ptax_internet/consultaBoletim.do?method=consultarBoletim&RadOpcao=2&DATAINI=<DD/MM/YYYY>&DATAFIM=&ChkMoeda=61` (USD; `ChkMoeda=222` for EUR).
   - One `taxa_usd_brl` and one `taxa_eur_brl` for the whole snapshot.
3. **Read each statement** (Read for PDFs, vision for images) and extract one row per position.
   Map source → broker/product per the table below.
4. **Write the staged array** to `…/{YYYY-MM}/investments/_positions.json` (a plain JSON array;
   key order doesn't matter — the script normalizes it).
5. **Validate + write** the canonical file:
   ```
   node plugins/open-personal-finance/scripts/investments.mjs --household {h} --month {YYYY-MM}
   ```
   Fix any `ERROR` in `_positions.json` and re-run. Cross-check the printed totals against the
   statements; review `WARN`s (unknown broker/product, type mismatch, duplicates).
6. **Assess.** Once the snapshot is written, run [`/assess`](../assess/SKILL.md): it produces an
   objective month-over-month diff (`assess_facts_{month}.json`), then you reason over it and write
   the verdict (summary + `assess_{month}.md` + `assess_{month}.json`). Focus on real actions
   (quantity moved), structural changes (a holding appeared/vanished), and integrity errors — not
   price drift. Fix any integrity error at the source (`_positions.json`, then re-run steps 5–6) and
   relay the summary before calling the month done.

## Row shape

Canonical key order (the script enforces it; EUR fields appended only on EUR rows):

```
month_year, broker, holder, type, product, nome,
quantidade, quantidade_usd, taxa_usd_brl, valor_atual, updated_at[, quantidade_eur, taxa_eur_brl]
```

- `holder` — lowercase first name (`michel`, `carol`).
- `type` — `frozen` for **FGTS** and **Vesting** (locked); `available` for everything else (incl. Vested).
- `valor_atual` — current value in **BRL** (USD/EUR positions × the PTAX rate).
- `quantidade_usd` — USD-denominated balance (or, for Morgan Stanley NU rows, the **per-share USD price**); `taxa_usd_brl` required when set. Both `null` on pure-BRL rows.
- EUR rows add `quantidade_eur` + `taxa_eur_brl` and keep `taxa_usd_brl: null`.

## Source → broker / product

| Input token | broker | Products it yields |
|---|---|---|
| `*_btg_conta`, `btg-{h}` (PDF) | `BTG` | `Ações BRA`, `Fundo Imobiliário`, `Renda Fixa`, `Tesouro Direto`, `Disponível para Investir` (saldo) |
| `*_btg_us`, `btg-us-{h}` (PDF) | `BTG` | `Ações US` (ETFs), `Renda Fixa US`, `Disponível para Investir` (Conta Corrente USD) |
| `*_etrade`, `etrade-{h}` | `Morgan Stanley` | NU:NYSE vested/vesting share **counts** + per-share USD price |
| `*_fgts`, `fgts-{h}` | `Caixa` | `FGTS` (frozen; `nome` = employer entity) |
| `*_nubank`, `nubank-{h}` | `Nubank` | `Disponível para Investir` (pots), `Reserva de Emergência`, `ETF` (USDC) |
| `*_nubank_global_eur`, `nubank-euro-{h}` | `Nubank` | `Disponível para Investir` EUR (Conta Global EUR) — EUR fields |
| `*_nubank_global_usd` | `Nubank` | `Disponível para Investir` USD (Conta Global USD) |
| `*_wise`, `wise-{h}` | `Wise` | `Disponível para Investir` (Conta Corrente BRL + USD) |
| `*_nomad` | `Nomad` | `Disponível para Investir` / `Ações US` as shown |

## Morgan Stanley (Nubank RSUs)

- **Vested** (E*Trade "Sellable") → `product: "Ações (Vested Nubank)"`, `type: available`, `nome: "Vested"`.
- **Unvested** (E*Trade "Unvested") → `product: "Ações (Unvested Nubank)"`, `type: frozen`, `nome: "Unvested"`.
- **Pending Release** → **separate row**, `product: "Ações (Unvested Nubank)"`, `type: frozen`,
  `nome: "Pending Release"`. It is the near-release subset of Unvested — the two frozen rows
  (`Unvested` + `Pending Release`) together make up the Unvested total. Keep it broken out when
  the E*Trade "Status" view shows it —
  it's tracked as its own line so its month-over-month movement is visible. If a given month's screenshot
  only shows the single "Unvested" total (the "Sell" view), record Unvested as one row and omit Pending
  Release for that month.
- `quantidade` = share count; `quantidade_usd` = **per-share USD price** (from the E*Trade screenshot);
  `valor_atual = quantidade × quantidade_usd × taxa_usd_brl`.
- Vested + Unvested (+ Pending Release) share counts should tie to the E*Trade "Total". The per-share
  price is a live quote, so capture both holders' screenshots close in time — otherwise their per-share
  USD differs slightly (same stock, quoted minutes apart), which is harmless but avoidable.

## Notes

- BTG PDFs are issued under "AUVP CAPITAL" but are BTG Pactual accounts — broker stays `BTG`.
- Empty pots emit no row. New brokers/products (e.g. Nomad) just `WARN` — confirm with the user, then they pass.
- A new product not in the taxonomy is allowed (warns only); keep `product` consistent with prior months so the same holding isn't renamed.
- If a position is ambiguous or a value can't be read, ask the user rather than guessing — don't fabricate `valor_atual`.
