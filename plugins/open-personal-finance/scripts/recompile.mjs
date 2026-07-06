// Rebuild a month's flat budget array in the canonical schema:
//  - preserve prior classifications (manual /classify edits win)
//  - auto-classify NEW rows from expenses_memory.md / income_memory.md (no hardcoded maps)
//  - parse installment fields, enrich opaque descriptions
//  - carry prior provisionals forward, reconciling them against newly-posted real rows
// Usage: node recompile.mjs --household <name> --month <YYYY-MM> [--resources <dir>]
import path from 'node:path';
import { parseArgs, resolvePaths, readJson, writeJson, budgetPath } from './lib/env.mjs';
import { buildRow } from './lib/schema.mjs';
import { loadRules, classify } from './lib/memory.mjs';

const args = parseArgs(process.argv.slice(2));
const { householdDir, monthDir, resultDir, month } = resolvePaths(args);

const raw = readJson(path.join(monthDir, 'transactions_raw.json'), []);
const budgetFile = budgetPath(resultDir, month);
const prior = readJson(budgetFile, []);
const rules = loadRules(householdDir);

const priorById = new Map();
for (const r of prior) if (!r.provisional && r.id) priorById.set(r.id, r);
// Fallback index by natural key so prior classifications survive Pluggy transaction-id churn
// (a re-connected item reissues every id, breaking id-based preservation). Key ignores both
// the id AND the description — a reconnected item also rewrites merchant strings, so only
// date | abs(amount cents) | account | holder is stable. Matched greedily; identical colliding
// rows share a classification anyway.
const natKey = (r) =>
  `${(r.date || '').slice(0, 10)}|${Math.abs(Math.round((Number(r.amount) || 0) * 100))}|${r.account_number || ''}|${r.holder || ''}`;
const priorByKey = new Map();
for (const r of prior) {
  if (r.provisional || !r.type || r.type === 'unclassified') continue;
  const k = natKey(r);
  if (!priorByKey.has(k)) priorByKey.set(k, []);
  priorByKey.get(k).push(r);
}
const provisionals = prior.filter((r) => r.provisional);

let preserved = 0, preservedByKey = 0, auto = 0, unclassified = 0;
const real = [];
for (const tx of raw) {
  const row = buildRow(tx, null);
  let p = priorById.get(tx.id);
  if (!(p && p.type && p.type !== 'unclassified')) {
    const q = priorByKey.get(natKey(row));
    if (q && q.length) { p = q.shift(); preservedByKey++; }
  }
  if (p && p.type && p.type !== 'unclassified') {
    row.type = p.type;
    row.bucket = p.bucket ?? null;
    row.category = p.category ?? null;
    row.subcategory = p.subcategory ?? null;
    preserved++;
  } else {
    const cls = classify(row.description, rules);
    if (cls) { Object.assign(row, cls); auto++; }
    else unclassified++;
  }
  // Income is always a positive figure in the budget. BANK credits arrive sign-flipped
  // by budgetAmount (which flips BANK so expenses read positive), so normalize here once
  // the row's type is known.
  if (row.type === 'income' && typeof row.amount === 'number') row.amount = Math.abs(row.amount);
  real.push(row);
}

// Reconcile provisionals against observed reality.
const realExpenseKeys = new Set(real.filter((r) => r.type === 'expense').map((r) => `${r.category}|${r.subcategory}`));
const realIncomeHolders = new Set(real.filter((r) => r.type === 'income').map((r) => r.holder));
function provHolder(p) {
  const s = `${p.id} ${p.description} ${p.holder || ''}`.toLowerCase();
  if (/carol/.test(s)) return 'carol';
  if (/michel/.test(s)) return 'michel';
  return p.holder || null;
}
// --final (used by /settle when closing a month) strips ALL provisionals.
const keptProv = args.final ? [] : provisionals.filter((p) => {
  if (p.type === 'income') return !realIncomeHolders.has(provHolder(p));
  if (p.type === 'expense') return !realExpenseKeys.has(`${p.category}|${p.subcategory}`);
  return true;
});
const droppedProv = provisionals.length - keptProv.length;

const out = [...real, ...keptProv];
writeJson(budgetFile, out);

console.error(`Recompiled ${month}: real=${real.length} (preserved=${preserved} [byKey=${preservedByKey}], auto=${auto}, unclassified=${unclassified}), provisional=${keptProv.length} (dropped=${droppedProv}), total=${out.length}`);
const unc = real.filter((r) => r.type === 'unclassified');
if (unc.length) {
  console.error(`\nUnclassified -> run /classify on these ${unc.length}:`);
  for (const r of unc) console.error(`  ${r.id} | ${r.date} | ${r.holder} | R$ ${r.amount} | ${r.description}`);
}
