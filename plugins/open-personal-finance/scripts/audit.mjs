// Validate + auto-fix a month's budget against the canonical schema. Retries up to 3x.
// Usage: node audit.mjs --household <name> --month <YYYY-MM> [--resources <dir>]
import path from 'node:path';
import { parseArgs, resolvePaths, readJson, writeJson, budgetPath, prevMonth } from './lib/env.mjs';
import { VALID_TYPES, VALID_BUCKETS, enrichDescription } from './lib/schema.mjs';

// Detect + reverse mojibake: UTF-8 text that was decoded as latin-1/cp1252 and re-encoded
// as UTF-8 (e.g. "Transferência" -> "TransferÃªncia"). Returns the repaired string, or null
// when the input isn't confidently double-encoded — so it never mangles already-correct text
// (a genuine "São"/"—" is left untouched). Applied per-string, which is what makes a mixed
// file safe. Classic Windows cause: PowerShell Get-Content|Set-Content or Python open('w')
// rewriting a UTF-8 JSON without forcing utf-8.
function demojibake(s) {
  if (typeof s !== 'string' || !s) return null;
  const bytes = Buffer.from(s, 'latin1');
  if (bytes.toString('latin1') !== s) return null;      // had chars > U+00FF -> not pure mojibake
  const decoded = bytes.toString('utf8');
  if (decoded === s || decoded.includes('�')) return null;
  if (!Buffer.from(decoded, 'utf8').equals(bytes)) return null; // must round-trip exactly
  return decoded;
}

// ── Installment continuity ────────────────────────────────────────────────
// A charge split into N parts posts one installment per month. When a plan carried
// installment k/N in a recent month and the month being audited has no k+1/N (a lag: it
// hasn't posted yet), we provision the successor so the month's projected total stays honest.
//
// We scan the LAST TWO months (not just the previous one) so a plan that briefly dropped out
// of M-1 is still projected, and we advance exactly one step per plan per month (keyed off the
// HIGHEST installment seen for that plan, real OR provisional) so chained provisionals don't
// over-project future installments.
//
// A plan is identified by merchant + holder + account + totalInstallments + amount (rounded to
// the nearest real). Installment NUMBERS come from the structured `installmentNumber` /
// `totalInstallments` fields — never re-parsed from text; the description is used ONLY to isolate
// the merchant, by removing the exact known "k/N" token (not a regex guess). Merchant + amount
// together are what keep concurrent plans apart: the amount separates two same-merchant plans
// (the two "PG *DOREL" 10x at R$475.86 vs R$125.93), and the merchant separates two same-amount
// plans (Pacheco vs Ven*Loja, both ~R$108.9 over 3x); rounding the amount keeps one plan together
// despite cents-level rounding between installments (Labs A+ 42.32 then 42.31).
// An installment row carries the structured fields installmentNumber (k) and totalInstallments
// (N) — set once by recompile. We read those keys directly; we do NOT re-parse "k/N" out of the
// free-text description (that would be guessing when the values are already structured).
function instFields(r) {
  const n = r.installmentNumber, t = r.totalInstallments;
  return (Number.isInteger(n) && Number.isInteger(t) && t >= 2 && n >= 1 && n <= t) ? { n, t } : null;
}
// Merchant identity: the description with the KNOWN "k/N" token (from the structured installment
// fields) and any provisioned suffix removed by an EXACT match — not a regex guess of the numbers.
function instBase(r) {
  let d = (r.description || '').replace(/\s*-\s*provisioned\s*$/i, '').trim();
  const tok = `${r.installmentNumber}/${r.totalInstallments}`;
  const i = d.indexOf(tok);
  if (i >= 0) d = d.slice(0, i).trim();
  return d.toLowerCase();
}
function instSlug(s) {
  return (s || '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
}
// Plan identity: merchant + holder + account + N + amount (rounded to the nearest real). The
// merchant separates two different plans that share an amount (e.g. "Drogarias Pacheco" vs
// "Drogaria Ven*Loja", both ~R$108.9 over 3x); the amount separates two concurrent same-merchant
// plans (the two "PG *DOREL" 10x plans at R$475.86 vs R$125.93); rounding to the nearest real
// keeps a single plan together despite cents-level rounding between installments (Labs A+ 42.32
// then 42.31). Installment numbers come from the structured fields, never re-parsed from text.
function instPlanKey(r, f) {
  return `${instBase(r)}|${r.holder || ''}|${r.account_number || ''}|${f.t}|${Math.round(Number(r.amount) || 0)}`;
}
// Successor description: swap the installment number in the source text using the KNOWN
// installmentNumber (an exact substring replace, not a pattern guess), then tag as provisioned.
function instSuccessorDesc(src, next, total) {
  const base = (src.description || '').replace(/\s*-\s*provisioned\s*$/i, '');
  const oldTok = `${src.installmentNumber}/${total}`;
  const swapped = base.includes(oldTok) ? base.replace(oldTok, `${next}/${total}`) : `${base} ${next}/${total}`;
  return `${swapped} - provisioned`;
}
// Mutates `rows`, appending provisional successor rows. Returns the rows it added.
// `prevMonths` is a list of prior months' row arrays to scan for active plans.
function provisionInstallments(rows, prevMonths) {
  // Recent plans -> highest installment seen (real or provisional) across the scanned months.
  const plans = new Map();
  for (const prevRows of prevMonths) {
    for (const r of prevRows) {
      if (r.type !== 'expense' || !r.bucket || !r.category || !r.subcategory) continue;
      const f = instFields(r);
      if (!f) continue;
      const key = instPlanKey(r, f);
      const cur = plans.get(key);
      if (!cur || f.n > cur.n) plans.set(key, { n: f.n, t: f.t, row: r });
    }
  }
  // Successors already present this month (real or provisional) — never double-provision.
  const present = new Set();
  for (const r of rows) {
    if (r.type !== 'expense') continue;
    const f = instFields(r);
    if (!f) continue;
    present.add(`${instPlanKey(r, f)}|${f.n}`);
  }
  const added = [];
  for (const [key, plan] of plans) {
    if (plan.n >= plan.t) continue;                 // plan already finished
    const next = plan.n + 1;
    if (present.has(`${key}|${next}`)) continue;     // successor already there
    const src = plan.row;
    const id = `manual:prov:inst:${instSlug(instBase(src))}:${src.holder || ''}:${src.account_number || ''}:${plan.t}:${Math.round(Number(src.amount) || 0)}:${next}`;
    if (rows.some((r) => r.id === id)) continue;
    added.push({
      id,
      description: instSuccessorDesc(src, next, plan.t),
      holder: src.holder ?? null,
      bank: src.bank ?? null,
      account_number: src.account_number ?? null,
      source: src.source ?? 'Credit Card',
      provisional: true,
      type: 'expense',
      amount: src.amount,
      bucket: src.bucket,
      category: src.category,
      subcategory: src.subcategory,
      installmentNumber: next,
      totalInstallments: plan.t,
    });
  }
  for (const r of added) rows.push(r);
  return added;
}

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
    else if (demojibake(r.description) !== null) issues.push({ kind: 'MOJIBAKE', id: r.id });
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
  // Repair mojibake by re-deriving the clean description from the matching raw tx (the source
  // of truth is always clean UTF-8). Fall back to reversing the double-encode in place for rows
  // with no raw twin (provisionals, manual: rows, or churned ids). NO_ENRICH re-adds any dropped
  // "(category - subcategory)" suffix on the next attempt.
  for (const iss of issues.filter((i) => i.kind === 'MOJIBAKE')) {
    const r = rows.find((x) => x.id === iss.id);
    if (!r) continue;
    const raw = rawById.get(r.id);
    const fromRaw = raw ? enrichDescription(raw) : null;
    const clean = (fromRaw && demojibake(fromRaw) === null) ? fromRaw : demojibake(r.description);
    if (clean && clean !== r.description) { r.description = clean; fixed++; }
  }
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

// Installment continuity: provision any next-installment that lagged out of this month.
// Skipped for --final (a closed month is stripped of provisionals by /settle) and when the
// previous month's budget doesn't exist yet.
if (!args.final) {
  const readMonthRows = (mm) => readJson(budgetPath(path.join(householdDir, mm, 'expenses', 'result'), mm), []);
  const pm1 = prevMonth(month);
  const pm2 = prevMonth(pm1);
  const added = provisionInstallments(rows, [readMonthRows(pm1), readMonthRows(pm2)]);
  if (added.length) {
    console.error(`Installment audit: provisioned ${added.length} missing next-installment row(s):`);
    for (const a of added) console.error(`  + ${a.description}  R$ ${a.amount}  [${a.holder}]`);
    writeJson(budgetFile, rows);
  }
}

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
