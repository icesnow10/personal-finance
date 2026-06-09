// Parse classification rules from a household's expenses_memory.md / income_memory.md
// so /recompile can auto-classify deterministically. The memory files are the single
// source of truth for merchant -> category/subcategory mappings; no hardcoded per-month maps.
import fs from 'node:fs';
import path from 'node:path';
import { CATEGORY_BUCKET, bucketForCategory } from './schema.mjs';

const EXPENSE_CATEGORIES = new Set(Object.keys(CATEGORY_BUCKET));
// Special category tokens used in the memory tables.
const SPECIAL = new Set(['Skip', 'Income', 'Refund']);

function tableRows(md) {
  const rows = [];
  for (const line of md.split(/\r?\n/)) {
    const t = line.trim();
    if (!t.startsWith('|')) continue;
    if (/^\|[\s:|-]+\|?$/.test(t)) continue; // separator row
    // Split on unescaped pipes only so patterns like "Transferência enviada\|NOMAD" stay intact.
    const cells = t.split(/(?<!\\)\|/).slice(1, -1).map((c) => c.trim());
    if (cells.length) rows.push(cells);
  }
  return rows;
}

// Normalize text (pattern or description) into a comparable match key:
// unescape \|, drop trailing "(qualifier)", remove '*', collapse spaces, lowercase.
function normalize(s) {
  return (s || '')
    .replace(/\\\|/g, '|')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
const matchKey = normalize;

function classificationFor(category, subcategory) {
  if (category === 'Skip') return { type: 'skipped', bucket: null, category: null, subcategory: null };
  if (category === 'Income') return { type: 'income', bucket: null, category: 'Income', subcategory: subcategory || null };
  if (category === 'Refund') return { type: 'expense', bucket: 'conforto', category: 'Shopping', subcategory: 'Refund' };
  if (EXPENSE_CATEGORIES.has(category)) {
    return { type: 'expense', bucket: bucketForCategory(category), category, subcategory: subcategory || null };
  }
  return null;
}

export function loadRules(householdDir) {
  const rules = [];
  const seen = new Set();
  const add = (pattern, category, subcategory) => {
    const cls = classificationFor(category, subcategory);
    if (!cls) return;
    // Expand a pattern into match keys: split "A / B" alternatives, and for "<opaque>|<merchant>"
    // also key on the merchant suffix (descriptions get re-enriched/renamed with varying prefixes).
    const keys = new Set();
    for (const part of pattern.split(/\s+\/\s+/)) {
      const k = matchKey(part);
      if (k && k.length >= 2) keys.add(k);
      const pipe = k.lastIndexOf('|');
      if (pipe >= 0 && k.length - pipe - 1 >= 4) keys.add(k.slice(pipe + 1).trim());
    }
    for (const key of keys) {
      const id = `${key}=>${category}/${subcategory}`;
      if (seen.has(id)) continue;
      seen.add(id);
      rules.push({ key, pattern, ...cls });
    }
  };

  // --- expenses_memory.md: merchant/override tables ---
  const expPath = path.join(householdDir, 'expenses_memory.md');
  if (fs.existsSync(expPath)) {
    const md = fs.readFileSync(expPath, 'utf8');
    for (const cells of tableRows(md)) {
      // classification rows: pattern | category | subcategory [| notes]
      const [pattern, category, subcategory] = cells;
      if (!category) continue;
      if (EXPENSE_CATEGORIES.has(category) || SPECIAL.has(category)) add(pattern, category, subcategory);
    }
    // Descriptions table: "Pluggy pattern | Meaning" — derive salary/income/skip rules.
    for (const cells of tableRows(md)) {
      if (cells.length !== 2) continue;
      const [pattern, meaning] = cells;
      if (/salary/i.test(meaning) && /michel/i.test(meaning)) add(pattern, 'Income', 'Salary');
      else if (/salary/i.test(meaning) && /carol/i.test(meaning)) add(pattern, 'Income', 'Salary (Carol)');
      else if (/fgts/i.test(meaning)) add(pattern, 'Income', 'FGTS Saque Aniversário');
      else if (/\bskip\b|internal/i.test(meaning)) add(pattern, 'Skip', null);
    }
  }

  // Longer (more specific) patterns first so they win over generic ones.
  rules.sort((a, b) => b.key.length - a.key.length);
  return rules;
}

function matchRules(desc, rules) {
  const d = normalize(desc);
  if (!d) return null;
  for (const r of rules) {
    if (d.includes(r.key)) return { type: r.type, bucket: r.bucket, category: r.category, subcategory: r.subcategory };
  }
  return null;
}

const SHOPPING_REFUND = { type: 'expense', bucket: 'conforto', category: 'Shopping', subcategory: 'Refund' };

// Classify one description against the rules. Returns a classification or null.
export function classify(desc, rules) {
  if (!desc) return null;
  // IOF charges/refunds -> Shopping/Refund (IOF), regardless of the merchant in the string.
  if (/^iof\b/i.test(desc.trim())) {
    return { type: 'expense', bucket: 'conforto', category: 'Shopping', subcategory: 'Refund (IOF)' };
  }
  // "Estorno de <merchant>" / "Crédito de <merchant>" -> refund to the merchant's own
  // category (negative amount); fall back to Shopping/Refund when no merchant is found.
  const refund = desc.match(/^(?:estorno|cr[ée]dito|ajuste a cr[ée]dito) de\s+(.+)/i);
  if (refund) {
    const rest = refund[1].replace(/^["']+|["'.]+$/g, '').trim();
    if (/^compra\b/i.test(rest) || rest.length < 3) return SHOPPING_REFUND;
    const sub = matchRules(rest, rules);
    return sub && sub.type === 'expense' ? sub : SHOPPING_REFUND;
  }
  return matchRules(desc, rules);
}
