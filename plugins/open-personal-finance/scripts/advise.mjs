// Build the two Telegram budget messages from a month's canonical budget. Data-driven.
// Usage: node advise.mjs --household <name> --month <YYYY-MM> [--resources <dir>]
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, resolvePaths, readJson, budgetPath, monthLabelPt, prevMonth } from './lib/env.mjs';

const args = parseArgs(process.argv.slice(2));
const { householdDir, resultDir, month } = resolvePaths(args);
const rows = readJson(budgetPath(resultDir, month), []);
const prevResult = path.join(householdDir, prevMonth(month), 'expenses', 'result');
const prior = readJson(budgetPath(prevResult, prevMonth(month)), []);
const flags = readJson(path.join(householdDir, month, '_classification_flags.json'), []);

const [, mm] = month.split('-').map(Number);
const MONTH_LAST_DAY = new Date(Date.UTC(+month.split('-')[0], mm, 0)).getUTCDate();
const dates = rows.filter((r) => !r.provisional && r.date).map((r) => r.date).sort();
const dataThrough = dates.length ? dates[dates.length - 1] : `${month}-01`;
const dayOfMonth = +dataThrough.slice(8, 10);
const partial = rows.some((r) => r.provisional);
const mm2 = String(mm).padStart(2, '0');

const fmt = (n) => 'R$ ' + Math.round(Math.abs(n)).toLocaleString('pt-BR');
const fmtSigned = (n) => (n < 0 ? '-' : '') + fmt(n);
const sumIncome = (p) => rows.filter((r) => r.type === 'income' && !!r.provisional === p).reduce((s, r) => s + Math.abs(r.amount), 0);
const realExp = () => rows.filter((r) => r.type === 'expense' && !r.provisional).reduce((s, r) => s + r.amount, 0);
const provExp = () => rows.filter((r) => r.type === 'expense' && r.provisional).reduce((s, r) => s + r.amount, 0);
function byBucket(p) {
  const o = { custos_fixos: 0, conforto: 0, liberdade_financeira: 0 };
  for (const r of rows) { if (r.type !== 'expense' || !r.bucket) continue; if (p !== undefined && !!r.provisional !== p) continue; o[r.bucket] += r.amount; }
  return o;
}

const incomeReal = sumIncome(false), incomeProv = sumIncome(true), incomeTotal = incomeReal + incomeProv;
const expReal = realExp(), expProv = provExp(), expTotal = expReal + expProv;
const net = incomeTotal - expTotal;
const bReal = byBucket(false), bProv = byBucket(true);
const bTotal = { custos_fixos: bReal.custos_fixos + bProv.custos_fixos, conforto: bReal.conforto + bProv.conforto, liberdade_financeira: bReal.liberdade_financeira + bProv.liberdade_financeira };
const target = { custos_fixos: incomeTotal * 0.25, conforto: incomeTotal * 0.30, liberdade_financeira: incomeTotal * 0.45 };
const pct = {
  custos_fixos: incomeTotal ? (bTotal.custos_fixos / incomeTotal) * 100 : 0,
  conforto: incomeTotal ? (bTotal.conforto / incomeTotal) * 100 : 0,
  liberdade_financeira: incomeTotal ? ((incomeTotal - expTotal) / incomeTotal) * 100 : 0,
};
const status = (a, t) => { const d = Math.abs(a - t); return d <= 3 ? '✅' : d <= 7 ? '⚠️' : '🔴'; };

function topCategories(rs) {
  const map = new Map();
  for (const r of rs) { if (r.type !== 'expense' || !r.category) continue; if (!map.has(r.category)) map.set(r.category, { amount: 0, bucket: r.bucket }); map.get(r.category).amount += r.amount; }
  return [...map.entries()].map(([category, v]) => ({ category, amount: v.amount, bucket: v.bucket })).sort((a, b) => b.amount - a.amount);
}
const priorTop = new Map(topCategories(prior).map((t) => [t.category, t.amount]));
const EMOJI = { custos_fixos: '🔵', conforto: '🟠', liberdade_financeira: '🟢' };
function cmp(curr, prev) {
  if (prev === undefined || prev === 0) return curr === 0 ? '→ estável' : 'novo';
  if (Math.abs(curr - prev) < 1) return '→ estável';
  const d = curr - prev;
  return `${d > 0 ? '▲' : '▼'}${Math.abs(Math.round((d / Math.abs(prev)) * 100))}% · ${d > 0 ? '+' : '-'}${fmt(d)}`;
}
const top10 = topCategories(rows).slice(0, 10)
  .map((c, i) => `${i + 1}. ${EMOJI[c.bucket] || '⚪'} ${c.category}: ${c.amount < 0 ? '-' : ''}${fmt(c.amount)} (${cmp(c.amount, priorTop.get(c.category))})`).join('\n');

const cfRemain = target.custos_fixos - bTotal.custos_fixos;
const coRemain = target.conforto - bTotal.conforto;
const lfBelow = target.liberdade_financeira - (incomeTotal - expTotal);
const leftover = (name, c, r) => r >= 0 ? `${c} ${name}: ${fmt(r)} de folga` : `${c} ${name}: ${fmt(-r)} acima`;
const leftoverTotal = Math.max(0, cfRemain) + Math.max(0, coRemain);
const lfTxt = lfBelow <= 0 ? `hoje +${fmt(-lfBelow)} acima do alvo` : `hoje ${fmt(lfBelow)} abaixo do alvo`;

const msg1 = `💚 ${fmt(leftoverTotal)} ainda disponíveis pra gastar este mês

${leftover('Custos Fixos', '🔵', cfRemain)}
${leftover('Conforto', '🟠', coRemain)}
🟢 Liberdade Financeira: cada R$ não gasto vira investimento (${lfTxt})

Quanto menos do leftover você usar, mais engorda a Liberdade Financeira.`;

function bucketLine(name, bk) {
  const remain = target[bk] - (bReal[bk] + bProv[bk]);
  const provStr = bProv[bk] > 0 ? ` (+${fmt(bProv[bk])} prov.)` : '';
  const tail = remain >= 0 ? `sobra ${fmt(remain)}` : `acima ${fmt(-remain)}`;
  return `${status(pct[bk], bk === 'custos_fixos' ? 25 : 30)} ${name}: ${pct[bk].toFixed(1)}% — ${fmt(bReal[bk])}${provStr} de ${fmt(target[bk])} (${tail})`;
}
const lfLine = `${status(pct.liberdade_financeira, 45)} Lib. Financeira: ${pct.liberdade_financeira.toFixed(1)}% — ${fmt(Math.max(0, incomeTotal - expTotal))} disponíveis p/ investir (o que não foi gasto vira liberdade financeira)`;
const partialTag = partial ? ` (parcial até ${String(dayOfMonth).padStart(2, '0')}/${mm2})` : '';
const expensesLine = expProv > 0 ? `💸 Despesas: ${fmt(expReal)} (+ ${fmt(expProv)} prov. = ${fmt(expTotal)})` : `💸 Despesas: ${fmt(expReal)}`;

const installments = rows.filter((r) => r.type === 'expense' && !r.provisional && r.totalInstallments >= 2);
const instLines = installments.map((r) => {
  const remain = r.totalInstallments - r.installmentNumber;
  return { remain, value: r.amount * remain, txt: `${r.description.replace(/\s+\d+\/\d+.*/, '').trim()} ${r.installmentNumber}/${r.totalInstallments} — restam ${remain} (~${fmt(r.amount * remain)})` };
}).filter((x) => x.remain >= 1).sort((a, b) => b.value - a.value).map((x) => x.txt);

const provPending = rows.filter((r) => r.provisional && r.type === 'expense');
const unclassified = rows.filter((r) => r.type === 'unclassified');
const bullets = (a) => a.length ? a.map((s) => `* ${s}`).join('\n') : '* —';

const destaques = [];
if (partial) destaques.push(`Mês parcial até ${String(dayOfMonth).padStart(2, '0')}/${mm2}: ${incomeProv > 0 ? `salários provisionados (${fmt(incomeProv)} aguardando crédito); ` : ''}${expProv > 0 ? `${fmt(expProv)} de custos fixos recorrentes provisionados` : 'receita já creditada'}`);
destaques.push(`${installments.length} parcelas ativas na fatura (${fmt(installments.reduce((s, r) => s + r.amount, 0))})`);

const fique = [];
if (provPending.length) fique.push(`Provisões pendentes: ${provPending.map((r) => `${r.subcategory} (${fmt(r.amount)})`).join(', ')}`);
for (const f of [...flags].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 4)) fique.push(f.flag);
fique.push(...instLines.slice(0, 4));

const rec = [];
rec.push(lfBelow > 0 ? `Liberdade Financeira ${fmt(lfBelow)} abaixo do alvo de 45% — segurar gastos discricionários` : `Liberdade Financeira em dia — manter o ritmo`);
if (incomeProv > 0) rec.push(`Receita ainda parcialmente provisionada — salários caem no fim do mês`);

const unclassifiedSection = unclassified.length === 0
  ? `❓ Não categorizados: 0 — tudo classificado!`
  : `❓ Não categorizados: ${unclassified.length} transações\n` + unclassified.slice(0, 5).map((r) => `* ${r.description} — ${fmt(r.amount)} (${r.date})`).join('\n');

const msg2 = `📊 Budget ${monthLabelPt(month)}${partialTag}

💰 Receita: ${fmt(incomeReal)}${incomeProv > 0 ? ` (+ ${fmt(incomeProv)} prov. = ${fmt(incomeTotal)})` : ''}
${expensesLine}
📈 Saldo: ${fmtSigned(net)}

Orçamento por bucket:
${bucketLine('Custos Fixos', 'custos_fixos')}
${bucketLine('Conforto', 'conforto')}
${lfLine}

🔎 Top 10 Categorias (vs mês anterior):
${top10}

🏆 Destaques:
${bullets(destaques)}

⚠️ Fique de olho:
${bullets(fique)}

💡 Recomendações:
${bullets(rec)}

${unclassifiedSection}`;

console.log('=== MESSAGE 1 ===\n' + msg1);
console.log('\n=== MESSAGE 2 ===\n' + msg2);
fs.writeFileSync(path.join(resultDir, '_advise_msg1.txt'), msg1);
fs.writeFileSync(path.join(resultDir, '_advise_msg2.txt'), msg2);
