# open-personal-finance

Claude Code skills for personal finance: fetch bank and credit card transactions via [Pluggy](https://pluggy.ai) (Brazil's Open Finance), classify expenses, recognize income, and generate monthly budget reports — all orchestrated through Claude Code skills.

## Skills

| Skill | What it does |
|---|---|
| `/onboard` | **Start here.** Creates the household folder, initializes `.env.local` + memory files, and runs `/accounts` if credentials are set. |
| `/compile` | Orchestrates the full pipeline: `/fetch` → `/recognize` → `/categorize` → `/forecast` (if partial month) → `/advise` → `/notify`. Produces a JSON budget report. |
| `/fetch` | Runs `/accounts` first, then connects to Pluggy API to download BANK + CREDIT transactions. Normalizes into `transactions_raw.json`. Falls back to CSV parsing. |
| `/accounts` | Auto-detects holder (Identity API), bank (Item API), and account numbers (Accounts API) for each Pluggy item. Saves `pluggy_items.json`. |
| `/recognize` | Identifies income from savings account movements — salary, cashback, IOF adjustments, yields, named transfers. Provisions expected salary for partial months. |
| `/categorize` | Classifies expenses into categories using merchant mappings from `expenses_memory.md`. Handles refunds, RDB, and flags uncategorized items. |
| `/classify` | Classifies specific transactions (not whole-month). Updates `expenses_memory.md` and `income_memory.md` with new patterns. |
| `/provision` | Partial months only. Estimates recurring fixed costs not yet charged, based on last 2 completed months. |
| `/forecast` | Partial months only. Combines `/recognize` (salary provisioning) + `/provision` (expense estimates). |
| `/heartbeat` | Periodic pulse — fetches new transactions, appends, re-compiles preserving classifications. Fully unattended. |
| `/settle` | Finalizes previous month (strips provisional items), then triggers `/heartbeat` for current month. |
| `/advise` | Analyzes compiled budget → health checks, category spotlights, momentum, wins/alerts, recommendations. |
| `/notify` | Sends insights via Telegram. Skips silently if not configured. |
| `/transactions` | Lists all transactions for a month in a markdown table. |
| `/classified` | Lists only classified transactions grouped by category. |
| `/missing` | Lists only uncategorized transactions. |

## Getting Started

```
/onboard
```

The wizard will:
1. Ask for a household name
2. Create `resources/{household}/` folder
3. Initialize `.env.local`, `expenses_memory.md`, `income_memory.md`
4. Run `/accounts` if Pluggy credentials are filled in

After onboard, run `/compile` to fetch transactions and generate your first budget.

## Household

All data is scoped by **household** — a short lowercase name (e.g. `household-1`, `household-2`) chosen during `/onboard`. Multiple households coexist in the same project:

```
resources/
  household-1/
    .env.local                # Pluggy + Telegram credentials
    expenses_memory.md        # Merchant-to-category mappings
    income_memory.md          # Salary definitions and income rules
    pluggy_items.json         # Auto-detected holders, banks, accounts
    2026-04/
      expenses/
        transactions_raw.json
        result/
          budget_apr_2026.json
          insights_*.json
  household-2/
    .env.local
    ...
```

## Credentials

Each household has its own `resources/{household}/.env.local`:

```env
# Required — from dashboard.pluggy.ai
PLUGGY_CLIENT_ID=your_client_id
PLUGGY_CLIENT_SECRET=your_client_secret
PLUGGY_ITEM_IDS=item_id_1,item_id_2

# Optional — for /notify via Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

## Connecting to Pluggy (Open Finance)

1. **MeuPluggy** — go to [meu.pluggy.ai](https://meu.pluggy.ai), sign up, connect your bank accounts via Open Finance
2. **Developer account** — go to [dashboard.pluggy.ai](https://dashboard.pluggy.ai), create an application → get `client_id` + `client_secret`
3. **Link accounts** — in the Demo app, connect your MeuPluggy account. This creates an **Item** per connected bank
4. **Copy Item IDs** — click ⋮ → "Copy Item ID" for each connected bank
5. **Fill `.env.local`** — paste credentials into `resources/{household}/.env.local`
6. **Run `/accounts`** — auto-detects holders, banks, and account numbers from Pluggy APIs

> Multiple banks? Each bank is a separate Item. Add all IDs comma-separated in `PLUGGY_ITEM_IDS`.

## Normalized Transaction Fields

Each transaction in `transactions_raw.json`:

| Field | Description |
|---|---|
| `date` | YYYY-MM-DD |
| `description` | Cleaned description |
| `amount` | BRL amount (string) |
| `category_name` | Pluggy's original category (if any) |
| `account_name` | Account name from the bank |
| `account_number` | Account or card number |
| `holder` | Full name (auto-detected from Identity API) |
| `bank` | Institution name (auto-detected from COMPE code) |

## FAQ

**Posso conectar mais de uma conta bancária?**
Sim. Cada banco gera um Item separado. Adicione todos os Item IDs separados por vírgula em `PLUGGY_ITEM_IDS`.

**Posso adicionar contas de pessoas diferentes?**
Sim. O `/accounts` detecta automaticamente o titular de cada conta via a Identity API do Pluggy. O mapeamento fica em `pluggy_items.json`.

**E se eu tiver mais de um household?**
Rode `/onboard` com um nome diferente. Cada household tem seu próprio diretório e `.env.local` — dados completamente isolados.

**E se o Pluggy estiver fora do ar?**
O `/fetch` aceita CSVs manuais. Coloque em `resources/{household}/{YYYY-MM}/expenses/input/`: `cc-{holder}-{bank}-*.csv` para cartão e `savings-{holder}-{bank}-*.csv` para conta.

**Precisa rodar `/compile` todo mês?**
Sim. Ou configure `/heartbeat` como cron para atualizações automáticas e `/settle` no início do mês seguinte para fechar.
