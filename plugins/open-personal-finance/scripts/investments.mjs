// Validate a staged investments-positions array and write the canonical
// personal_finances_<month>.json (field order + types + FX rules enforced).
//
// Usage:
//   node investments.mjs --household <name> --month <YYYY-MM> \
//        [--in <staging.json>] [--updated-at <ISO>] [--resources <dir>]
//
// The model extracts positions from investments/input/* (vision/PDF work) and
// writes them — in any key order — to the staging file. This script is the
// deterministic gate: it reorders keys to the canonical shape, stamps a single
// updated_at on every row, validates structure/currency rules, and only writes
// the final result when there are no hard errors. Mirrors audit.mjs in spirit.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, readJson, writeJson } from './lib/env.mjs';

const args = parseArgs(process.argv.slice(2));
const household = args.household;
const month = args.month;
if (!household || !month) throw new Error('Required: --household <name> --month <YYYY-MM>');
if (!/^\d{4}-\d{2}$/.test(month)) throw new Error(`Bad --month "${month}" (expected YYYY-MM)`);

const resources = args.resources || path.join(process.cwd(), 'resources');
const investDir = path.join(resources, household, month, 'investments');
const resultDir = path.join(investDir, 'result');
const inFile = args.in || path.join(investDir, '_positions.json');
const outFile = path.join(resultDir, `personal_finances_${month}.json`);
const updatedAt = args['updated-at'] || new Date().toISOString();

const PRODUCTS = new Set([
  'Ações BRA', 'Ações US', 'Fundo Imobiliário', 'Tesouro Direto',
  'Renda Fixa', 'Renda Fixa US', 'Disponível para Investir',
  'Reserva de Emergência', 'ETF', 'Ações (Vested Nubank)',
  'Ações (Unvested Nubank)', 'FGTS',
]);
const BROKERS_KNOWN = new Set(['BTG', 'Morgan Stanley', 'Caixa', 'Nubank', 'Wise', 'Nomad', 'Etrade']);
const TYPES = new Set(['available', 'frozen']);

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const errors = [];
const warns = [];

const staged = readJson(inFile, null);
if (!Array.isArray(staged)) {
  console.error(`No staged positions array at ${inFile}. Write the extracted positions there first.`);
  process.exit(1);
}

// Canonical row: fixed key order; EUR fields appended only when present.
function canonical(r) {
  const row = {
    month_year: month,
    broker: r.broker,
    holder: r.holder,
    type: r.type,
    product: r.product,
    nome: r.nome,
    quantidade: r.quantidade,
    quantidade_usd: r.quantidade_usd ?? null,
    taxa_usd_brl: r.taxa_usd_brl ?? null,
    valor_atual: r.valor_atual,
    updated_at: updatedAt,
  };
  if (r.quantidade_eur != null || r.taxa_eur_brl != null) {
    row.quantidade_eur = r.quantidade_eur ?? null;
    row.taxa_eur_brl = r.taxa_eur_brl ?? null;
  }
  return row;
}

const rows = staged.map(canonical);
const seen = new Map();

rows.forEach((r, i) => {
  const at = `row ${i} (${r.broker}/${r.holder}/${r.nome})`;
  if (!r.broker) errors.push(`${at}: missing broker`);
  else if (!BROKERS_KNOWN.has(r.broker)) warns.push(`${at}: unknown broker "${r.broker}"`);
  if (!r.holder || r.holder !== r.holder.toLowerCase()) errors.push(`${at}: holder must be lowercase first name`);
  if (!TYPES.has(r.type)) errors.push(`${at}: bad type "${r.type}" (available|frozen)`);
  if (!r.product) errors.push(`${at}: missing product`);
  else if (!PRODUCTS.has(r.product)) warns.push(`${at}: unknown product "${r.product}"`);
  if (!r.nome) errors.push(`${at}: missing nome`);
  if (!isNum(r.quantidade)) errors.push(`${at}: quantidade must be a number`);
  if (!isNum(r.valor_atual)) errors.push(`${at}: valor_atual must be a number`);

  // Currency rules. USD-denominated rows carry a rate; EUR rows carry eur fields
  // and leave taxa_usd_brl null (see SCHEMA / 2026-03 missing_information.md).
  if (r.quantidade_usd != null) {
    if (!isNum(r.quantidade_usd)) errors.push(`${at}: quantidade_usd must be a number or null`);
    if (!isNum(r.taxa_usd_brl)) errors.push(`${at}: USD row needs numeric taxa_usd_brl`);
  }
  if ('quantidade_eur' in r) {
    if (!isNum(r.quantidade_eur)) errors.push(`${at}: quantidade_eur must be a number`);
    if (!isNum(r.taxa_eur_brl)) errors.push(`${at}: EUR row needs numeric taxa_eur_brl`);
    if (r.taxa_usd_brl != null) warns.push(`${at}: EUR row should have taxa_usd_brl=null`);
  }

  // Soft type/product coherence: FGTS and Vesting are frozen; the rest available.
  const expectFrozen = r.product === 'FGTS' || /Unvested|Vesting/.test(r.product || '');
  if (expectFrozen && r.type !== 'frozen') warns.push(`${at}: product "${r.product}" usually type=frozen`);
  if (!expectFrozen && r.type === 'frozen') warns.push(`${at}: product "${r.product}" usually type=available`);

  const key = [r.broker, r.holder, r.type, r.product, r.nome].join('|');
  if (seen.has(key)) warns.push(`${at}: duplicate of row ${seen.get(key)} (${key})`);
  else seen.set(key, i);
});

for (const w of warns) console.error('WARN ', w);
if (errors.length) {
  for (const e of errors) console.error('ERROR', e);
  console.error(`\n${errors.length} error(s) — fix ${inFile} and re-run. Nothing written.`);
  process.exit(1);
}

writeJson(outFile, rows);

// Summary so the model can sanity-check totals against the screenshots.
const brl = (n) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const total = rows.reduce((s, r) => s + r.valor_atual, 0);
const byType = {};
const byBroker = {};
for (const r of rows) {
  byType[r.type] = (byType[r.type] || 0) + r.valor_atual;
  byBroker[r.broker] = (byBroker[r.broker] || 0) + r.valor_atual;
}
console.error(`\nWrote ${rows.length} rows → ${path.relative(process.cwd(), outFile)}`);
console.error(`Total: R$ ${brl(total)}`);
for (const [t, v] of Object.entries(byType)) console.error(`  ${t}: R$ ${brl(v)}`);
console.error('By broker:');
for (const [b, v] of Object.entries(byBroker).sort((a, c) => c[1] - a[1])) console.error(`  ${b}: R$ ${brl(v)}`);
if (warns.length) console.error(`\n(${warns.length} warning(s) above — review but not blocking.)`);
