# Expenses Classification Memory

This file stores classification overrides and merchant-to-category mappings learned from manual review.
Used as a reference for future monthly budget analyses.

## Principles

**Cash-basis:** All income and expenses are accounted in the month the transaction posts. Never skip a transaction because it "belongs to" a prior month. If salary lands on March 2, it is March income.

## Pluggy-specific Patterns

Pluggy API returns different descriptions from your bank app. Map them here as you discover them:

| Pluggy pattern | Meaning |
|---|---|
| EMPRESA XYZ LTDA | Your Salary (employer transfer) |
| CAIXA ECONOMICA FEDERAL | FGTS Saque Aniversario |
| SPOUSE NAME (transfer sent) | Skip — internal household transfer |
| YOUR NAME (transfer sent to own account) | Skip — internal transfer (own accounts) |
| CONDOMINIO ABC (transfer sent) | Housing/Condo |

## Holder Corrections

Use this when Pluggy assigns a transaction to the wrong holder (e.g. a transfer received on one account that belongs to the other person).

| Description | Correct Holder | Notes |
|---|---|---|
| Cashback (Credito em conta on spouse's account) | spouse | Posted to spouse's savings |

## Budget Buckets

Each expense category maps to a financial planning bucket with a target percentage of total income. Adjust the percentages to match your financial goals.

| Bucket | Target % | Categories |
|---|---:|---|
| Custos Fixos (Essencial) | 25% | Housing, Health, Insurance, Groceries, Transportation, Wellness |
| Conforto (Estilo de vida) | 30% | Subscriptions, Personal Care, Services, Food/Dining, Recreation, Shopping, Travel, Family Support |
| Liberdade Financeira | 45% | Net (receita - despesas). Explicit investments tracked separately when they exist |

## Manual Overrides

When auto-classification gets it wrong, add overrides here. These take precedence over Known Merchants.

| Merchant / Description | Category | Subcategory | Notes |
|---|---|---|---|
| Street Vendor Joe | Food/Dining | Street Vendor | Not a generic service |
| Beach Kiosk Bar | Food/Dining | Beach Kiosk | Not recreation |
| Yoga Studio | Wellness | Gym/Training | Not a subscription |
| HEALTH INSURANCE CO | Health | Reimbursement | Net against Health expenses (reduce category total). NOT income |
| Aplicacao RDB | Skip | Internal transfer (caixinha/RDB) | Not an expense — money moved to savings box |
| Resgate RDB | Skip | Internal withdrawal | Internal movement, do not count as income or expense |
| IOF de compra internacional | Shopping | Refund (IOF) | IOF charges — negative expense in Shopping/conforto, not income |
| Estorno de compra | Refund | (original category) | Allocate refund to the original merchant's category as negative amount |

## Known Merchants

This table grows automatically as `/learn` discovers new patterns. You can also add merchants manually.

| Merchant Pattern | Category | Subcategory |
|---|---|---|
| RENT COMPANY | Housing | Rent/Mortgage |
| CONDO ADMIN | Housing | Condo |
| LIGHT / ENERGY CO | Housing | Electricity |
| GAS COMPANY | Housing | Gas Utility |
| INTERNET PROVIDER | Housing | Internet/Phone |
| MOBILE CARRIER | Housing | Mobile Plan |
| CLEANING PERSON | Housing | House Cleaning |
| GAS STATION * | Transportation | Fuel |
| Uber* | Transportation | Ride-hailing |
| 99app | Transportation | Ride-hailing |
| TOLL TAG * | Transportation | Tolls |
| METRO / BUS | Transportation | Public Transit |
| PARKING LOT | Transportation | Parking |
| SUPERMARKET A | Groceries | Supermarket |
| SUPERMARKET B | Groceries | Supermarket |
| PHARMACY A | Health | Pharmacy |
| PHARMACY B | Health | Pharmacy |
| HOSPITAL ABC | Health | Hospital |
| MEDICAL LAB | Health | Medical Lab |
| RESTAURANT X | Food/Dining | Restaurant |
| FAST FOOD Y | Food/Dining | Fast Food |
| ICE CREAM SHOP | Food/Dining | Ice Cream |
| SMALL MARKET | Food/Dining | Market |
| Amazon* | Shopping | Amazon |
| Mercadolivre* | Shopping | MercadoLivre |
| CLOTHING STORE | Shopping | Clothing |
| BABY STORE | Shopping | Baby Products |
| HOME IMPROVEMENT | Shopping | Home Improvement |
| Apple.Com/Bill | Subscriptions | Apple |
| Netflix | Subscriptions | Entertainment |
| Spotify | Subscriptions | Music |
| OpenAI *ChatGPT | Subscriptions | AI Tools |
| GYM NAME | Wellness | Gym |
| SPORTS CLUB | Wellness | Club/Sports |
| Airbnb | Travel | Accommodation |
| AIRLINE NAME | Travel | Flights |
| BOOKING.COM | Travel | Booking |
| LIFE INSURANCE CO | Insurance | Life Insurance |
| FAMILY MEMBER 1 | Family Support | Family |
| FAMILY MEMBER 2 | Family Support | Family |
| PHOTOGRAPHER | Services | Photographer |
| BARBER SHOP | Personal Care | Barber |
| EVENT TICKETS | Recreation | Events |

## RDB Threshold

Intentional RDB threshold: R$ 5,000.00 (amounts above this are intentional lump-sum investments, not auto Troco Turbo)

## Active Subscriptions

Track active subscriptions here so `/provision` can estimate them for partial months.

| Service | Expected Amount | Holder | Notes |
|---|---|---|---|
| Netflix | 55.90 | holder1 | Family plan |
| Spotify | 34.90 | holder1 | Individual |
| Apple iCloud | 3.50 | holder2 | 50GB plan |
| OpenAI ChatGPT | 20.00 | holder1 | Plus plan (USD) |
| YouTube Premium | 35.00 | holder1 | Via family member |

## Cancelled Subscriptions

Move subscriptions here when cancelled so `/provision` stops estimating them.

| Service | Cancelled Since | Notes |
|---|---|---|
| Disney+ | 2026-01 | Cancelled after price increase |
