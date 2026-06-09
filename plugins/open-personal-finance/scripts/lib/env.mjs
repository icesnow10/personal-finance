// Shared CLI / path / env helpers for the open-personal-finance pipeline scripts.
import fs from 'node:fs';
import path from 'node:path';

export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) args[key] = true;
    else { args[key] = next; i++; }
  }
  return args;
}

// Resolve the standard resource paths from --household / --month (--resources optional).
export function resolvePaths(args) {
  const household = args.household;
  const month = args.month;
  if (!household || !month) throw new Error('Required: --household <name> --month <YYYY-MM>');
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error(`Bad --month "${month}" (expected YYYY-MM)`);
  const resources = args.resources || path.join(process.cwd(), 'resources');
  const householdDir = path.join(resources, household);
  const monthDir = path.join(householdDir, month, 'expenses');
  const resultDir = path.join(monthDir, 'result');
  return { resources, household, month, householdDir, monthDir, resultDir };
}

export function loadEnv(householdDir) {
  const envPath = path.join(householdDir, '.env.local');
  const env = {};
  if (!fs.existsSync(envPath)) return env;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

const MONTH_ABBR = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export function budgetFileName(month) {
  const [y, mm] = month.split('-');
  return `budget_${MONTH_ABBR[+mm - 1]}_${y}.json`;
}
export function budgetPath(resultDir, month) {
  return path.join(resultDir, budgetFileName(month));
}
export function monthLabelPt(month) {
  const [y, mm] = month.split('-');
  return `${MONTH_PT[+mm - 1]} ${y}`;
}
export function prevMonth(month) {
  let [y, mm] = month.split('-').map(Number);
  if (mm === 1) { y -= 1; mm = 12; } else { mm -= 1; }
  return `${y}-${String(mm).padStart(2, '0')}`;
}
export function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, '')); }
  catch { return fallback; }
}
export function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}
