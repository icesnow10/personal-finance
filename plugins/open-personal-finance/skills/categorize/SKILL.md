---
name: categorize
description: Classify expense transactions into categories using merchant patterns from expenses_memory.md. Handles refunds, special transactions, and flags uncategorized items. Use when /compile calls it or when the user asks to categorize or classify expenses.
---

# Categorize Expenses

Classifies expense transactions into categories using merchant-to-category mappings.

## Household

The `{household}` is a short lowercase name that scopes all data.

## Input

A target month transaction list from `transactions_pluggy_raw.json` or equivalent explicit input files.

## Reference Files

- `resources/{household}/expenses_memory.md`

## Classification Process

1. Read merchant mappings and manual overrides.
2. Match each transaction description against known patterns.
3. Apply fallback heuristics for obvious merchants.
4. Enrich opaque descriptions: if the original description is generic or opaque (e.g. "Transferência Recebida", "Pagamento efetuado", "Transferência enviada|COMPANY NAME"), append a clarifying suffix in parentheses with the classification context (e.g. `"Pagamento efetuado|GRPQA (Aluguel)"`, `"Transferência Recebida (FGTS Saque Aniversário - holder2)"`). Do not replace the original text — only append.
5. Leave anything still unknown in `unclassified`.

## Category / Subcategory Reference

Valid combinations by bucket. Use these as reference when classifying — do not invent new categories without checking `expenses_memory.md` first.

### custos_fixos

| Category | Subcategories |
|---|---|
| Housing | Rent/Mortgage, Condo, Electricity, Gas Utility, Internet/Phone, Mobile Plan, House Cleaning, Admin Fee |
| Health | Pharmacy, Medical Lab, Health Plan/Service, Hospital, Reimbursement (negative), Medical Services, Wellness Plan, Pediatrician, Instrumentadora |
| Insurance | Life Insurance |
| Groceries | Supermarket |
| Transportation | Fuel, Ride-hailing, Tolls, Public Transit, Parking |
| Wellness | Gym, Gym/Training, Club/Sports, Surf Training |

### conforto

| Category | Subcategories |
|---|---|
| Shopping | Amazon, MercadoLivre, Clothing, Clothing/Shoes, Baby Products, Baby/Kids Products, Home Improvement, Home (Camicado), Cosmetics, Perfumery, Jewelry, Electronics, Sports Merchandise, Sports/Athletic, Mall (Rio Sul), Mall (Downtown), Customs/Import, Party Supplies, General, Online Store, Gift, Books, Flowers, Hardware, Newsstand, Refund (IOF) |
| Travel | Accommodation, Flights, Booking, Tour Package, NuViagens |
| Food/Dining | Restaurant, Bar/Restaurant, Fast Food, Ice Cream, Juice Bar, Market, Specialty Food, Coconut (Street Vendor), Beach Kiosk, Market (Convenience) |
| Subscriptions | Apple, AI Tools, YouTube Premium, Finance App, Design Tools, Microsoft |
| Services | Designer, Photographer, Photographer (Surf), Personal |
| Family Support | Family |
| Recreation | Leisure/Comfort, Events |
| Personal Care | Barber, Spa |

## Special Handling

| Transaction Type | Treatment |
|---|---|
| Aplicacao RDB (small auto) | Investment / Troco Turbo expense |
| Aplicacao RDB (large intentional) | Intentional RDB, not part of expense totals |
| Estorno / refund | Negative transaction in the original category |
| Reimbursements | Negative transaction in the corresponding category |
| IOF (all types: compra internacional, ajuste a crédito, IOF de volta) | Negative expense in Shopping / Refund (IOF) under conforto bucket. Never classify as income |
| Foreign currency transactions (`currencyCode != "BRL"`) | Use `amountInAccountCurrency` (already converted to BRL by Pluggy) as the row's `amount`. Never use raw `amount`, which is in the native currency. Example: Openai $20 USD → `amountInAccountCurrency` 105.36 → `amount: 105.36` in the budget row |

## Bucket Invariants

- Each category maps to **exactly one bucket**. Never emit two rows with the same `(category, subcategory)` pair but different `bucket` values. Downstream aggregators group by category name and will double-count a category that appears in multiple buckets.
- `Transportation` (all subcategories — `Fuel`, `Ride-hailing`, `Tolls`, `Public Transit`, `Parking`) is always `custos_fixos`. Uber/99/Táxi rows are never `conforto`.
- After classification, run a self-check: for each unique `(category, subcategory)` in the output, confirm all rows share the same bucket. If not, fix to match `resources/{household}/expenses_memory.md` before returning.

## Reconciliation with Provisioned Rows

When a real expense lands in a partial month that already contains provisioned rows (`"provisional": true`, id prefix `manual-expense:` or `manual:prov:...`), reconcile so that provisioning does not double-count the observed spending.

### Matching rule

A real expense row matches a provisional row when **all** of these hold:
- Provisional's `category` and `subcategory` equal the real row's `category` and `subcategory`.
- Provisional's `holder` equals the real row's `holder`.
- Provisional's description stem (text before ` - provisioned`) matches the real merchant pattern, using the same rules that would map both to the same memory entry. If the provisional was seeded from a specific merchant (e.g. `Cursor, Ai Powered Ide - provisioned`), it only matches real rows from that merchant — not any `Subscriptions / AI Tools` charge.
- When no merchant stem is present (generic provisionals like `Nu Seguro Vida - provisioned`), match by `(category, subcategory, holder)` only.

### Adjustment

For each real expense row, find the first unmatched provisional that matches:

1. **Decrement** the provisional's `amount` by the real row's `amount` (use absolute values; refunds/estornos increase the provisional back).
2. If the resulting amount is **≤ 0.01** (rounding tolerance), **remove** the provisional row entirely.
3. If the resulting amount is still positive (pocket remainder), keep the provisional row with the new reduced amount and leave `provisional: true`.
4. A single real row consumes at most one provisional — if multiple provisionals could match, prefer the one whose amount is closest to (≥) the real amount, then fall back to the one with the largest remaining amount.
5. Never create negative provisional amounts. Never let reconciliation turn a provisional into an income row.

Apply reconciliation **after** classifying all real rows for the month, so every observed merchant is known before deciding which provisionals survive.

Log each adjustment (`provisional id`, old amount, new amount, consumed by real `id`) so the user can trace changes.

## Output

Return:
- a flat top-level JSON array of transaction rows
- expense rows with `bucket`, `category`, and `subcategory` filled in
- uncategorized rows left as `type: "unclassified"`
- intentional RDB entries kept as normal rows, not separate grouped sections
- surviving provisional rows with their reduced amounts (dropped provisionals are simply absent)

Do not emit totals, summaries, nested trees, bucket rollups, `transactions[]`, or any other wrapper structure. The output must stay as a top-level flat JSON array, and each transaction must preserve its stable `id`, `bank`, `account_number`, and installment fields (`totalInstallments`, `installmentNumber`) when present. In the raw Pluggy payload these live inside `metadata.totalInstallments` and `metadata.installmentNumber` — extract them to top-level fields in the budget row when `totalInstallments >= 2`.

After classification, run `/learn` to persist any newly discovered patterns to `expenses_memory.md`.
