import { readdir } from 'node:fs/promises';
import { computeMovers, historyUrl, loadCatalog, readJson, runBatch } from './history/engine.mjs';

const [command = 'status', ...args] = process.argv.slice(2);
const option = (name, fallback) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : fallback; };
const has = (name) => args.includes(name);
const requestedIsins = args.flatMap((value, index) => args[index - 1] === '--isin' ? [value] : []);
const batchSize = Number(option('--batch-size', process.env.KOERSPLEIN_BATCH_SIZE || 2));
if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 50) throw new Error('Batchgrootte moet tussen 1 en 50 liggen.');

const catalog = await loadCatalog();
const select = () => {
  if (has('--all')) {
    if (command === 'backfill' && process.env.KOERSPLEIN_ALLOW_FULL_BACKFILL !== 'yes') throw new Error('Volledige backfill geblokkeerd. Stel KOERSPLEIN_ALLOW_FULL_BACKFILL=yes bewust in.');
    return catalog;
  }
  if (!requestedIsins.length) return catalog;
  const selected = catalog.filter((item) => requestedIsins.includes(item.isin));
  const missing = requestedIsins.filter((isin) => !selected.some((item) => item.isin === isin));
  if (missing.length) throw new Error(`Geen gecontroleerde providerkoppeling voor: ${missing.join(', ')}`);
  return selected;
};

if (command === 'backfill' || command === 'update') {
  const results = await runBatch(select(), { mode: command, batchSize });
  for (const result of results) console.log(JSON.stringify(result));
  if (results.some((item) => item.outcome === 'error')) process.exitCode = 1;
} else if (command === 'status') {
  const status = await readJson(new URL('status.json', historyUrl), { instruments: {} });
  console.log(JSON.stringify(status, null, 2));
} else if (command === 'movers') {
  const files = (await readdir(historyUrl)).filter((name) => /^\w{12}\.json$/.test(name));
  const series = await Promise.all(files.map(async (name) => { const data = await readJson(new URL(name, historyUrl)); return { instrument: data.instrument, bars: data.bars, provider: data.provider.id }; }));
  console.log(JSON.stringify({ scope: 'configured-test-universe', generatedAt: new Date().toISOString(), movers: computeMovers(series) }, null, 2));
} else {
  throw new Error('Gebruik: backfill, update, status of movers.');
}
