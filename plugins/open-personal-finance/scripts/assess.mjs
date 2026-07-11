// Facts producer for the /assess skill. Computes an objective month-over-month diff of an
// investments snapshot — it does NOT judge. Judgment (what's actually noteworthy vs normal
// drift) is the model's job in the skill, reading the JSON this writes.
//
// Usage:
//   node assess.mjs --household <name> --month <YYYY-MM> [--resources <dir>]
//        [--prev <YYYY-MM>]   override the baseline (default: latest earlier month with a snapshot)
//        [--strict]           exit 1 if any integrity issue (objective errors only)
//        [--no-write]         print to console but don't write the facts file
//
// Reads   resources/{household}/{month}/investments/result/personal_finances_{month}.json
// Writes  resources/{household}/{month}/investments/result/assess_facts_{month}.json
//
// Per-holding change carries a `driver`:
//   qty   — the share/unit count moved → a real action happened (buy/sell/transfer). This matters.
//   price — count unchanged, only the value drifted → market noise. Usually NOT insight.
//   new   — absent last month, present now.
//   gone  — present last month, absent now (candidates[] lists same-holder rows with a similar
//           value, i.e. a possible rename/migration target).
// `integrity[]` are objective data errors (FX out of band, split rates, duplicate rows, a
// valor_atual that doesn't reconcile to quantity × price × rate). Those are always worth fixing.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, readJson } from './lib/env.mjs';

const args = parseArgs(process.argv.slice(2));
const household = args.household;
const month = args.month;
if (!household || !month) throw new Error('Required: --household <name> --month <YYYY-MM>');
if (!/^\d{4}-\d{2}$/.test(month)) throw new Error(`Bad --month "${month}" (expected YYYY-MM)`);

const resources = args.resources || path.join(process.cwd(), 'resources');
const householdDir = path.join(resources, household);
const USD_BAND = [3.0, 8.0];
const EUR_BAND = [3.5, 9.0];
const VALUE_EPS = 0.01;   // treat sub-cent value moves as unchanged
const QTY_EPS = 1e-6;

const snapPath = (m) => path.join(householdDir, m, 'investments', 'result', `personal_finances_${m}.json`);
const resultDir = path.join(householdDir, month, 'investments', 'result');
const idOf = (r) => [r.broker, r.holder, r.type, r.product, r.nome].join(' | ');
const fields = (r) => ({ broker: r.broker, holder: r.holder, type: r.type, product: r.product, nome: r.nome });
const r2 = (n) => Math.round(n * 100) / 100;
const brl = (n) => `R$ ${Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function monthsWithSnapshot() {
  if (!fs.existsSync(householdDir)) return [];
  return fs.readdirSync(householdDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^\d{4}-\d{2}$/.test(e.name) && fs.existsSync(snapPath(e.name)))
    .map((e) => e.name).sort();
}

const curRows = readJson(snapPath(month), null);
if (!Array.isArray(curRows)) {
  console.error(`No snapshot at ${snapPath(month)}. Run /investments for ${month} first.`);
  process.exit(1);
}

const available = monthsWithSnapshot();
const prev = args.prev || [...available].filter((m) => m < month).pop() || null;
const prev2 = prev ? [...available].filter((m) => m < prev).pop() : undefined;

function fold(rows) {
  const map = new Map();
  for (const r of rows || []) {
    const k = idOf(r);
    const e = map.get(k) || { value: 0, qty: 0, count: 0, row: r };
    e.value += Number(r.valor_atual) || 0;
    e.qty += Number(r.quantidade) || 0;
    e.count += 1;
    map.set(k, e);
  }
  return map;
}

const cur = fold(curRows);
const base = prev ? fold(readJson(snapPath(prev), [])) : new Map();
const base2 = prev2 ? fold(readJson(snapPath(prev2), [])) : new Map();

// ── Integrity (objective errors) ──
const integrity = [];
const usdRates = new Set(), eurRates = new Set();
for (const r of curRows) {
  if (r.taxa_usd_brl != null) usdRates.add(Number(r.taxa_usd_brl));
  if (r.taxa_eur_brl != null) eurRates.add(Number(r.taxa_eur_brl));
}
for (const v of usdRates) if (v < USD_BAND[0] || v > USD_BAND[1]) integrity.push({ kind: 'FX_OUT_OF_BAND', detail: `USD rate ${v} outside [${USD_BAND.join(', ')}]` });
for (const v of eurRates) if (v < EUR_BAND[0] || v > EUR_BAND[1]) integrity.push({ kind: 'FX_OUT_OF_BAND', detail: `EUR rate ${v} outside [${EUR_BAND.join(', ')}]` });
if (usdRates.size > 1) integrity.push({ kind: 'FX_SPLIT', detail: `${usdRates.size} USD rates in one snapshot: ${[...usdRates].join(', ')}` });
if (eurRates.size > 1) integrity.push({ kind: 'FX_SPLIT', detail: `${eurRates.size} EUR rates in one snapshot: ${[...eurRates].join(', ')}` });
for (const [k, e] of cur) if (e.count > 1) integrity.push({ kind: 'DUPLICATE', id: k, detail: `row appears ×${e.count}` });
// valor_atual should reconcile via one of the two known conventions:
//   share-based  → quantidade × quantidade_usd × taxa   (ETFs, RSUs)
//   balance-based → quantidade_usd × taxa                (funds, cash, where quantidade_usd is a total)
for (const r of curRows) {
  const v = Number(r.valor_atual);
  if (r.taxa_usd_brl != null && r.quantidade_usd != null) {
    const a = Number(r.quantidade) * Number(r.quantidade_usd) * Number(r.taxa_usd_brl);
    const b = Number(r.quantidade_usd) * Number(r.taxa_usd_brl);
    const tol = Math.max(1, 0.005 * Math.abs(v));
    if (Math.abs(v - a) > tol && Math.abs(v - b) > tol) integrity.push({ kind: 'VALUE_MISMATCH', id: idOf(r), detail: `valor_atual ${r2(v)} ≠ qty×usd×taxa (${r2(a)}) nor usd×taxa (${r2(b)})` });
  } else if (r.taxa_eur_brl != null && r.quantidade_eur != null) {
    const b = Number(r.quantidade_eur) * Number(r.taxa_eur_brl);
    const tol = Math.max(1, 0.005 * Math.abs(v));
    if (Math.abs(v - b) > tol) integrity.push({ kind: 'VALUE_MISMATCH', id: idOf(r), detail: `valor_atual ${r2(v)} ≠ eur×taxa (${r2(b)})` });
  }
}

// ── Per-holding changes ──
const priorOf = (k) => base2.has(k) ? { month: prev2, value: r2(base2.get(k).value) } : null;
const changes = [];
if (prev) {
  const newOnes = [];
  for (const [k, e] of cur) {
    const b = base.get(k);
    if (!b) { newOnes.push({ k, e }); continue; }
    const vDelta = e.value - b.value;
    const qDelta = e.qty - b.qty;
    const qtyChanged = Math.abs(qDelta) > QTY_EPS;
    if (!qtyChanged && Math.abs(vDelta) < VALUE_EPS) continue; // identical → skip
    changes.push({
      ...fields(e.row), status: 'changed', driver: qtyChanged ? 'qty' : 'price',
      value: { prev: r2(b.value), cur: r2(e.value), delta: r2(vDelta), pct: b.value ? r2((vDelta / b.value) * 100) : null },
      qty: { prev: b.qty, cur: e.qty, delta: r2(qDelta) },
      prior: priorOf(k),
    });
  }
  // gone
  for (const [k, b] of base) {
    if (cur.has(k)) continue;
    const candidates = [...cur.entries()]
      .filter(([, e]) => !base.has(idOf(e.row)) && e.row.holder === b.row.holder && b.value > 0 && Math.abs(e.value - b.value) <= 0.15 * b.value)
      .map(([ck, e]) => ({ id: ck, value: r2(e.value) }));
    changes.push({ ...fields(b.row), status: 'gone', driver: 'gone', value: { prev: r2(b.value), cur: 0, delta: r2(-b.value), pct: -100 }, qty: { prev: b.qty, cur: 0, delta: r2(-b.qty) }, prior: priorOf(k), candidates });
  }
  // new
  for (const { k, e } of newOnes) {
    const candidates = [...base.entries()]
      .filter(([, b]) => !cur.has(idOf(b.row)) && b.row.holder === e.row.holder && e.value > 0 && Math.abs(b.value - e.value) <= 0.15 * e.value)
      .map(([bk, b]) => ({ id: bk, value: r2(b.value) }));
    changes.push({ ...fields(e.row), status: 'new', driver: 'new', value: { prev: 0, cur: r2(e.value), delta: r2(e.value), pct: null }, qty: { prev: 0, cur: e.qty, delta: e.qty }, prior: priorOf(k), candidates });
  }
}

// ── Totals ──
const sum = (m) => [...m.values()].reduce((s, e) => s + e.value, 0);
const curTotal = sum(cur), baseTotal = prev ? sum(base) : null;
const byType = {}, byBroker = {};
for (const [, e] of cur) { byType[e.row.type] = (byType[e.row.type] || 0) + e.value; byBroker[e.row.broker] = (byBroker[e.row.broker] || 0) + e.value; }
const totals = {
  current: r2(curTotal),
  baseline: baseTotal == null ? null : r2(baseTotal),
  delta: baseTotal == null ? null : r2(curTotal - baseTotal),
  pct: baseTotal ? r2(((curTotal - baseTotal) / baseTotal) * 100) : null,
  by_type: Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, r2(v)])),
  by_broker: Object.fromEntries(Object.entries(byBroker).map(([k, v]) => [k, r2(v)])),
};

// ── Per-product buckets (the raw material for the model's per-area mini-reports) ──
const prodCur = {}, prodBase = {}, prodCount = {}, prodHolders = {};
for (const [, e] of cur) {
  prodCur[e.row.product] = (prodCur[e.row.product] || 0) + e.value;
  prodCount[e.row.product] = (prodCount[e.row.product] || 0) + 1;
  (prodHolders[e.row.product] ||= new Set()).add(e.row.holder);
}
for (const [, e] of base) prodBase[e.row.product] = (prodBase[e.row.product] || 0) + e.value;
const buckets = Object.keys(prodCur).map((p) => {
  const value = prodCur[p];
  const baseline = prev ? (prodBase[p] || 0) : null;
  return {
    product: p, value: r2(value), pct: curTotal ? r2((value / curTotal) * 100) : null,
    count: prodCount[p], holders: [...prodHolders[p]].sort(),
    baseline: baseline == null ? null : r2(baseline),
    delta: baseline == null ? null : r2(value - baseline),
    delta_pct: baseline ? r2(((value - baseline) / baseline) * 100) : null,
  };
}).sort((a, b) => b.value - a.value);

const facts = {
  household, month, baseline: prev, baseline_prior: prev2 || null,
  generated_at: new Date().toISOString(),
  totals, buckets, integrity,
  changes: changes.sort((a, b) => Math.abs(b.value.delta) - Math.abs(a.value.delta)),
};

// ── Console (compact — the real read is the model's) ──
const byDriver = changes.reduce((c, ch) => ((c[ch.driver] = (c[ch.driver] || 0) + 1), c), {});
console.log(`Facts ${household} ${month}${prev ? ` vs ${prev}` : ' (first month)'}: ` +
  `${changes.length} change(s) [new ${byDriver.new || 0}, gone ${byDriver.gone || 0}, qty ${byDriver.qty || 0}, price ${byDriver.price || 0}], ` +
  `${integrity.length} integrity issue(s).` +
  (baseTotal != null ? ` Total ${brl(curTotal)} (${totals.pct >= 0 ? '+' : ''}${totals.pct}% vs ${prev}).` : ''));
if (integrity.length) { console.log('\nIntegrity:'); for (const i of integrity) console.log(`  [${i.kind}] ${i.id ? i.id + ' — ' : ''}${i.detail}`); }
const acts = changes.filter((c) => c.driver !== 'price');
if (acts.length) { console.log('\nActions (qty / new / gone — price-only drift omitted here):'); for (const c of acts) console.log(`  [${c.driver}] ${idOf(c)}: ${brl(c.value.prev)} → ${brl(c.value.cur)}${c.candidates && c.candidates.length ? `  ~candidates: ${c.candidates.map((x) => x.id).join(' | ')}` : ''}`); }

if (!args['no-write']) {
  fs.mkdirSync(resultDir, { recursive: true });
  fs.writeFileSync(path.join(resultDir, `assess_facts_${month}.json`), JSON.stringify(facts, null, 2));
  console.log(`\nWrote assess_facts_${month}.json → ${path.relative(process.cwd(), resultDir)}`);
  console.log('Next: the /assess skill reads this, reasons about it, and writes the curated assess_' + month + '.json + .md + summary.');
}

if (args.strict && integrity.length) process.exit(1);
process.exit(0);
