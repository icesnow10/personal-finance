// Validate + auto-fix a month's budget against the canonical schema. Retries up to 3x.
// Usage: node audit.mjs --household <name> --month <YYYY-MM> [--resources <dir>]
import path from 'node:path';
import { parseArgs, resolvePaths, readJson, writeJson, budgetPath } from './lib/env.mjs';
import { VALID_TYPES, VALID_BUCKETS } from './lib/schema.mjs';

const args = parseArgs(process.argv.slice(2));
const { householdDir, monthDir, resultDir, month } = resolvePaths(args);
const budgetFile = budgetPath(resultDir, month);

const validAccts = new Set();
const items = readJson(path.join(householdDir, 'pluggy_items.json'), { items: {} }).items;
for (const item of Object.values(items)) for (const acc of Object.values(item.accounts)) validAccts.add(acc.number);

const raws = ['cc_open_bill.json', 'cc_closed_bill.json', 'savings.json']
  .flatMap((f) => readJson(path.join(monthDir, f), []));
const rawById = new Map(raws.map((r) => [r.id, r]));

function audit(rows) {
  const issues = [];
  const seen = new Map();
  if (!Array.isArray(rows)) issues.push({ kind: 'NOT_ARRAY' });
  for (const r of rows) {
    if (seen.has(r.id)) issues.push({ kind: 'DUP_ID', id: r.id }); else seen.set(r.id, r);
    if (!r.id) issues.push({ kind: 'MISSING_ID' });
    if (!VALID_TYPES.has(r.type)) issues.push({ kind: 'BAD_TYPE', id: r.id, type: r.type });
    if (typeof r.amount !== 'number') issues.push({ kind: 'BAD_AMOUNT', id: r.id });
    if (typeof r.description !== 'string') issues.push({ kind: 'BAD_DESC', id: r.id });
    if (!r.provisional && !/^\d{4}-\d{2}-\d{2}$/.test(r.date || '')) issues.push({ kind: 'BAD_DATE', id: r.id, date: r.date });
    // A closed month (--final) must contain no pending rows: once the bill closes every
    // charge is posted, so a lingering `pending` is a stale flag (or a row Pluggy dropped).
    if (args.final && !r.provisional && r.status === 'pending') issues.push({ kind: 'PENDING_IN_CLOSED_MONTH', id: r.id });
    // Income is a positive figure in the budget (never a negative/sign-flipped credit).
    if (r.type === 'income' && typeof r.amount === 'number' && r.amount < 0) issues.push({ kind: 'INCOME_NEGATIVE', id: r.id });
    if (r.type === 'expense') {
      if (!r.bucket) issues.push({ kind: 'EXPENSE_NO_BUCKET', id: r.id });
      else if (!VALID_BUCKETS.has(r.bucket)) issues.push({ kind: 'BAD_BUCKET', id: r.id, bucket: r.bucket });
      if (!r.category) issues.push({ kind: 'EXPENSE_NO_CAT', id: r.id });
      if (!r.subcategory) issues.push({ kind: 'EXPENSE_NO_SUBCAT', id: r.id });
    }
    if (!r.provisional && r.account_number && !validAccts.has(r.account_number)) {
      issues.push({ kind: 'BAD_ACCT', id: r.id, account_number: r.account_number });
    }
    if (!r.provisional && rawById.has(r.id)) {
      const raw = rawById.get(r.id);
      if (raw.currencyCode && raw.currencyCode !== 'BRL' && raw.amountInAccountCurrency != null) {
        const brl = Number(raw.amountInAccountCurrency);
        if (Math.abs(Math.abs(r.amount) - Math.abs(brl)) > 0.01) issues.push({ kind: 'FX_MISMATCH', id: r.id, expected: brl });
      }
    }
    if (r.type !== 'unclassified' && typeof r.description === 'string') {
      const d = r.description.trim();
      const opaque = /^Transferência Recebida$/.test(d) || /^Transferência enviada\|[^()]+$/.test(d) || /^Pagamento efetuado\|[^()]+$/.test(d);
      if (opaque && !d.includes('(')) issues.push({ kind: 'NO_ENRICH', id: r.id, desc: d });
    }
  }
  // Bucket consistency: a (category, subcategory) pair must map to one bucket.
  const groups = new Map();
  for (const r of rows) {
    if (r.type !== 'expense' || !r.category || !r.subcategory) continue;
    const k = `${r.category}|${r.subcategory}`;
    if (!groups.has(k)) groups.set(k, new Set());
    groups.get(k).add(r.bucket);
  }
  for (const [k, buckets] of groups) if (buckets.size > 1) issues.push({ kind: 'BUCKET_INCONSISTENT', pair: k, buckets: [...buckets] });
  return issues;
}

function autoFix(rows, issues) {
  let fixed = 0;
  for (const iss of issues.filter((i) => i.kind === 'NO_ENRICH')) {
    const r = rows.find((x) => x.id === iss.id);
    if (!r) continue;
    let label = [r.category, r.subcategory].filter(Boolean).join(' - ');
    if (!label && r.type === 'skipped') label = /NOMAD|WISE/i.test(r.description) ? 'Currency exchange' : 'Internal transfer';
    if (label) { r.description = `${r.description} (${label})`; fixed++; }
  }
  for (const iss of issues.filter((i) => i.kind === 'FX_MISMATCH')) {
    const r = rows.find((x) => x.id === iss.id);
    if (!r) continue;
    r.amount = (r.amount < 0 ? -1 : 1) * Math.abs(iss.expected); fixed++;
  }
  // Closed-month invariant: normalize any lingering pending row to posted.
  for (const iss of issues.filter((i) => i.kind === 'PENDING_IN_CLOSED_MONTH')) {
    const r = rows.find((x) => x.id === iss.id);
    if (r) { r.status = 'posted'; fixed++; }
  }
  for (const iss of issues.filter((i) => i.kind === 'INCOME_NEGATIVE')) {
    const r = rows.find((x) => x.id === iss.id);
    if (r) { r.amount = Math.abs(r.amount); fixed++; }
  }
  for (const iss of issues.filter((i) => i.kind === 'BUCKET_INCONSISTENT')) {
    const [cat, sub] = iss.pair.split('|');
    const group = rows.filter((r) => r.type === 'expense' && r.category === cat && r.subcategory === sub);
    const counts = {};
    for (const r of group) counts[r.bucket] = (counts[r.bucket] || 0) + 1;
    const target = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    for (const r of group) if (r.bucket !== target) { r.bucket = target; fixed++; }
  }
  return fixed;
}

let rows = readJson(budgetFile, []);
for (let attempt = 1; attempt <= 3; attempt++) {
  const issues = audit(rows);
  if (issues.length === 0) {
    writeJson(budgetFile, rows);
    console.error(`Audit OK (attempt ${attempt}) — ${rows.length} rows, 0 issues.`);
    process.exit(0);
  }
  console.error(`Audit attempt ${attempt}: ${issues.length} issues`);
  for (const i of issues) console.error('  ', JSON.stringify(i));
  console.error(`  auto-fixed ${autoFix(rows, issues)} issues`);
  writeJson(budgetFile, rows);
}
console.error('Audit STILL FAILING after 3 attempts.');
process.exit(1);
