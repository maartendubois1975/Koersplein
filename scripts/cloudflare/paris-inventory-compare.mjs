import fs from 'node:fs/promises';

const baselinePath = 'data/euronext-paris.json';
const freshPath = process.argv[2];
if (!freshPath) {
  console.error('Usage: node scripts/cloudflare/paris-inventory-compare.mjs <fresh-official-euronext-json>');
  process.exit(2);
}
const baseline = JSON.parse(await fs.readFile(baselinePath, 'utf8'));
const fresh = JSON.parse(await fs.readFile(freshPath, 'utf8'));
const allowed = new Set(['XPAR', 'ALXP', 'XMLI']);
const validIsin = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
const normalize = (data, label) => {
  if (!Array.isArray(data.shares)) throw Error(label + ': missing shares array');
  const rows = new Map();
  for (const row of data.shares) {
    if (!allowed.has(row.mic)) throw Error(label + ': unexpected MIC ' + row.mic);
    if (!validIsin.test(row.isin || '')) throw Error(label + ': invalid ISIN ' + row.isin);
    const key = row.isin + '|' + row.mic;
    if (rows.has(key)) throw Error(label + ': duplicate ' + key);
    rows.set(key, row);
  }
  return rows;
};
const oldRows = normalize(baseline, 'baseline');
const newRows = normalize(fresh, 'fresh');
if (!fresh.retrievedAt || new Date(fresh.retrievedAt).getTime() <= new Date(baseline.retrievedAt).getTime())
  throw Error('Fresh export must have a newer retrievedAt timestamp than baseline');
const added = [...newRows].filter(([key]) => !oldRows.has(key)).map(([key, row]) => ({key, ...row}));
const removed = [...oldRows].filter(([key]) => !newRows.has(key)).map(([key, row]) => ({key, ...row}));
const changed = [...newRows].filter(([key, row]) => oldRows.has(key) && JSON.stringify(oldRows.get(key)) !== JSON.stringify(row))
  .map(([key, row]) => ({key, before: oldRows.get(key), after: row}));
const countByMic = rows => Object.fromEntries([...allowed].map(mic => [mic, [...rows.values()].filter(row => row.mic === mic).length]));
const result = {
  baselineRetrievedAt: baseline.retrievedAt,
  freshRetrievedAt: fresh.retrievedAt,
  baseline: {total: oldRows.size, byMic: countByMic(oldRows)},
  fresh: {total: newRows.size, byMic: countByMic(newRows)},
  added, removed, changed,
  warning: 'Directory membership is not proof of executed trades. Verify instrument type and admission/trading status separately.'
};
await fs.mkdir('research/output', {recursive: true});
await fs.writeFile('research/output/paris-inventory-diff.json', JSON.stringify(result, null, 2) + '\n');
console.log('PARIS_INVENTORY_DIFF', JSON.stringify({baseline: result.baseline, fresh: result.fresh, added: added.length, removed: removed.length, changed: changed.length}));
