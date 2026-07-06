// Canonical budget-row schema helpers. The source of truth is the jan–may JSON shape:
// flat array of rows, each with the keys below; installment fields only on parcels.

// category -> bucket, derived from the jan–may source-of-truth budgets (0 conflicts).
export const CATEGORY_BUCKET = {
  Housing: 'custos_fixos',
  Health: 'custos_fixos',
  Insurance: 'custos_fixos',
  Groceries: 'custos_fixos',
  Transportation: 'custos_fixos',
  Wellness: 'custos_fixos',
  Taxes: 'custos_fixos',
  Subscriptions: 'conforto',
  'Personal Care': 'conforto',
  Services: 'conforto',
  'Food/Dining': 'conforto',
  Recreation: 'conforto',
  Shopping: 'conforto',
  Travel: 'conforto',
  'Family Support': 'conforto',
  Education: 'conforto',
  'Investment (Troco Turbo)': 'liberdade_financeira',
};
export function bucketForCategory(category) {
  return CATEGORY_BUCKET[category] ?? null;
}

export const VALID_TYPES = new Set(['income', 'expense', 'skipped', 'unclassified']);
export const VALID_BUCKETS = new Set(['custos_fixos', 'conforto', 'liberdade_financeira']);

export function parseInstallment(desc) {
  const m = (desc || '').match(/(\d+)\/(\d+)/);
  if (m && +m[2] >= 2) return { installmentNumber: +m[1], totalInstallments: +m[2] };
  return null;
}

// Normalize a raw Pluggy tx to a posted/pending marker. Credit charges are PENDING while
// the bill is open and POSTED once it closes; bank rows are effectively always posted.
export function normalizeStatus(tx) {
  const s = (tx._status || tx.status || '').toString().toUpperCase();
  return s === 'PENDING' ? 'pending' : 'posted';
}

export function firstNameLower(holder) {
  const f = (holder || '').split(' ')[0].toLowerCase();
  return f === 'carolina' ? 'carol' : f;
}

// Source label convention matching the jan–may budgets (trevo). Holder-based for BANK.
export function deriveSource(tx, holderFirst) {
  if (tx._bank === 'Wise') return 'Wise USD';
  if (tx._accountType === 'CREDIT') return 'Credit Card';
  if (tx._accountType === 'BANK') return holderFirst === 'carol' ? 'Nubank Savings' : 'Savings Account';
  return 'Other';
}

// Budget-side amount: BANK debits are negative in Pluggy; flip so expenses are positive.
// Coerce to Number so hand-entered rows with string amounts (e.g. "-35") stay numeric.
export function budgetAmount(tx) {
  const a = Number(tx.amount) || 0;
  return tx._accountType === 'BANK' ? -a : a;
}

const OPAQUE = [
  'Transferência enviada', 'Transferência recebida', 'Transferência Recebida',
  'Pagamento efetuado', 'Pagamento recebido', 'Compra no débito',
  'Transferência enviada pelo Pix', 'Transferência recebida pelo Pix',
];
// Append |<counterparty> from paymentData/merchant so downstream matching can see who it was.
export function enrichDescription(tx) {
  let desc = tx.description || tx.descriptionRaw || '';
  if (OPAQUE.includes(desc.trim())) {
    const tag = tx.paymentData?.receiver?.name || tx.paymentData?.payer?.name
      || tx.paymentData?.receiver?.documentNumber?.value || tx.merchant?.name || tx.merchant?.businessName;
    if (tag) desc = `${desc}|${tag}`;
  }
  return desc;
}

// Build a canonical real row from a raw Pluggy tx + a classification {type,bucket,category,subcategory}.
export function buildRow(tx, classification) {
  const holderFirst = firstNameLower(tx._holder);
  const desc = enrichDescription(tx);
  const row = {
    // Hand-entered raw rows can lack an id; synthesize a stable manual: id from their content
    // so preservation and audit (which require ids) stay deterministic across runs.
    id: tx.id || `manual:${(tx.date || '').slice(0, 10)}:${(desc || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 28)}`,
    date: (tx.date || '').slice(0, 10),
    description: desc,
    holder: holderFirst,
    bank: tx._bank,
    account_number: tx._accountNumber,
    source: deriveSource(tx, holderFirst),
    provisional: false,
    status: normalizeStatus(tx),
    type: classification?.type || 'unclassified',
    amount: budgetAmount(tx),
    bucket: classification?.bucket ?? null,
    category: classification?.category ?? null,
    subcategory: classification?.subcategory ?? null,
  };
  const inst = parseInstallment(desc);
  if (inst) Object.assign(row, inst);
  return row;
}
