// Fetch Pluggy BANK + CREDIT transactions for a month and write the raw + split files.
// Usage: node fetch.mjs --household <name> --month <YYYY-MM> [--resources <dir>]
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, resolvePaths, loadEnv, readJson, writeJson } from './lib/env.mjs';

const args = parseArgs(process.argv.slice(2));
const { household, month, householdDir, monthDir } = resolvePaths(args);

const env = loadEnv(householdDir);
const itemsFile = path.join(householdDir, 'pluggy_items.json');
const items = readJson(itemsFile, null)?.items;
if (!items) throw new Error(`No pluggy_items.json for ${household} (run /accounts first)`);

const [y, m] = month.split('-').map(Number);
const from = `${month}-01`;
const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
const to = `${month}-${String(lastDay).padStart(2, '0')}`;

async function auth() {
  const res = await fetch('https://api.pluggy.ai/auth', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: env.PLUGGY_CLIENT_ID, clientSecret: env.PLUGGY_CLIENT_SECRET }),
  });
  if (!res.ok) throw new Error(`auth failed: ${res.status} ${await res.text()}`);
  return (await res.json()).apiKey;
}

async function fetchTxs(apiKey, accountId) {
  const all = [];
  for (let page = 1; ; page++) {
    const url = `https://api.pluggy.ai/transactions?accountId=${accountId}&from=${from}&to=${to}&pageSize=500&page=${page}`;
    const res = await fetch(url, { headers: { 'X-API-KEY': apiKey } });
    if (!res.ok) throw new Error(`tx fetch failed: ${res.status} ${await res.text()}`);
    const results = (await res.json()).results || [];
    all.push(...results);
    if (results.length < 500) break;
  }
  return all;
}

function enrich(tx, item, acc) {
  const out = { ...tx };
  if ('creditCardMetadata' in out) { out.metadata = out.creditCardMetadata; delete out.creditCardMetadata; }
  out._holder = item.holder;
  out._accountType = acc.type;
  out._accountName = acc.name;
  out._accountNumber = acc.number;
  out._bank = item.bank;
  // Explicit posted/pending marker for downstream (recompile/viewer). Pluggy uses
  // status POSTED once a card bill closes; PENDING while the bill is still open.
  out._status = out.status === 'POSTED' ? 'posted' : 'pending';
  return out;
}

// When a credit-card bill closes, Pluggy re-issues the transaction under a NEW id with
// status POSTED, but the stale PENDING copy (old id) keeps coming back on subsequent
// fetches. Deduping by id alone can't catch it, so drop any PENDING credit row that a
// POSTED row already supersedes (same card + description + amount + date). Genuine still-
// pending charges (no POSTED twin) are kept.
function dropSupersededPending(rows) {
  const key = (r) => `${r._accountNumber}|${r.description}|${r.amount}|${(r.date || '').slice(0, 10)}`;
  const postedKeys = new Set(
    rows.filter((r) => r._accountType === 'CREDIT' && r.status === 'POSTED').map(key),
  );
  return rows.filter(
    (r) => !(r._accountType === 'CREDIT' && r.status === 'PENDING' && postedKeys.has(key(r))),
  );
}

const apiKey = await auth();
console.error('Authenticated.');
const fetched = [];
for (const item of Object.values(items)) {
  if (item.manual) { console.error(`Skipping manual item ${item.bank} / ${item.holder}`); continue; }
  for (const [accountId, acc] of Object.entries(item.accounts)) {
    console.error(`Fetching ${item.holder} / ${acc.name} (${acc.type})...`);
    const txs = await fetchTxs(apiKey, accountId);
    console.error(`  -> ${txs.length} transactions`);
    for (const tx of txs) fetched.push(enrich(tx, item, acc));
  }
}

// Merge with prior raw (prefer freshly fetched for matching ids), dedupe by id.
const rawPath = path.join(monthDir, 'transactions_raw.json');
const prior = readJson(rawPath, []);
const newIds = new Set(fetched.map((r) => r.id));
const merged = [...fetched, ...prior.filter((r) => !newIds.has(r.id))];
const seen = new Map();
for (const r of merged) if (!seen.has(r.id)) seen.set(r.id, r);
const byId = [...seen.values()];

// Identify closed bills and drop the stale PENDING duplicates they leave behind.
const deduped = dropSupersededPending(byId);
const removedGhosts = byId.length - deduped.length;

writeJson(rawPath, deduped);
console.error(`Wrote ${deduped.length} -> transactions_raw.json (was ${prior.length}, fetched ${fetched.length}, removed ${removedGhosts} superseded PENDING)`);

const ccOpen = deduped.filter((r) => r._accountType === 'CREDIT' && r.status === 'PENDING');
const ccClosed = deduped.filter((r) => r._accountType === 'CREDIT' && r.status === 'POSTED');
const savings = deduped.filter((r) => r._accountType === 'BANK');
writeJson(path.join(monthDir, 'cc_open_bill.json'), ccOpen);
writeJson(path.join(monthDir, 'cc_closed_bill.json'), ccClosed);
writeJson(path.join(monthDir, 'savings.json'), savings);
console.error(`Split -> cc_open=${ccOpen.length} (PENDING), cc_closed=${ccClosed.length} (POSTED), savings=${savings.length}`);
console.error(`PENDING credit transactions remaining: ${ccOpen.length}`);
