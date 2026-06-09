// Send the two advise messages to Telegram. Skips silently if Telegram is not configured.
// Usage: node notify.mjs --household <name> --month <YYYY-MM> [--resources <dir>]
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { parseArgs, resolvePaths, loadEnv } from './lib/env.mjs';

const args = parseArgs(process.argv.slice(2));
const { householdDir, resultDir } = resolvePaths(args);
const env = loadEnv(householdDir);
const TOKEN = env.TELEGRAM_BOT_TOKEN, CHAT_ID = env.TELEGRAM_CHAT_ID;
if (!TOKEN || !CHAT_ID) { console.error('Telegram not configured, skipping.'); process.exit(0); }

function send(text) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ chat_id: CHAT_ID, text });
    const req = https.request({
      hostname: 'api.telegram.org', path: `/bot${TOKEN}/sendMessage`, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let body = ''; res.on('data', (c) => (body += c));
      res.on('end', () => res.statusCode === 200 ? resolve(JSON.parse(body)) : reject(new Error(`Telegram ${res.statusCode}: ${body}`)));
    });
    req.on('error', reject); req.write(data); req.end();
  });
}

for (const f of ['_advise_msg1.txt', '_advise_msg2.txt']) {
  const p = path.join(resultDir, f);
  if (!fs.existsSync(p)) { console.error(`Missing ${f} — run advise first.`); continue; }
  const r = await send(fs.readFileSync(p, 'utf8'));
  console.error(`${f} sent:`, r.ok ? 'OK' : 'FAIL');
}
