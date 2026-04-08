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

### conforto

| Category | Subcategories |
|---|---|
| Shopping | Amazon, MercadoLivre, Clothing, Clothing/Shoes, Baby Products, Baby/Kids Products, Home Improvement, Home (Camicado), Cosmetics, Perfumery, Jewelry, Electronics, Sports Merchandise, Sports/Athletic, Mall (Rio Sul), Mall (Downtown), Customs/Import, Party Supplies, General, Online Store, Gift, Books, Flowers, Hardware, Newsstand |
| Travel | Accommodation, Flights, Booking, Tour Package, NuViagens |
| Food/Dining | Restaurant, Bar/Restaurant, Fast Food, Ice Cream, Juice Bar, Market, Specialty Food, Coconut (Street Vendor), Beach Kiosk, Market (Convenience) |
| Subscriptions | Apple, AI Tools, YouTube Premium, Finance App, Design Tools, Microsoft |
| Wellness | Gym, Gym/Training, Club/Sports, Surf Training, Spa |
| Services | Designer, Photographer, Photographer (Surf), Personal |
| Family Support | Family |
| Recreation | Leisure/Comfort, Events |
| Personal Care | Barber |

## Special Handling

| Transaction Type | Treatment |
|---|---|
| Aplicacao RDB (small auto) | Investment / Troco Turbo expense |
| Aplicacao RDB (large intentional) | Intentional RDB, not part of expense totals |
| Estorno / refund | Negative transaction in the original category |
| Reimbursements | Negative transaction in the corresponding category |
| IOF de compra internacional | Real expense, never provisional |

## Output

Return:
- a flat top-level JSON array of transaction rows
- expense rows with `bucket`, `category`, and `subcategory` filled in
- uncategorized rows left as `type: "unclassified"`
- intentional RDB entries kept as normal rows, not separate grouped sections

Do not emit totals, summaries, nested trees, bucket rollups, `transactions[]`, or any other wrapper structure. The output must stay as a top-level flat JSON array, and each transaction must preserve its stable `id`, `bank`, `account_number`, and installment fields (`totalInstallments`, `installmentNumber`) when present in the raw input.

After classification, run `/learn` to persist any newly discovered patterns to `expenses_memory.md`.
