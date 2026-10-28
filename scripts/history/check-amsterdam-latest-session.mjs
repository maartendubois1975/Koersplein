import { readFile } from 'node:fs/promises';
import { loadCatalog } from './engine.mjs';
const root = new URL('../../data/', import.meta.url);
const instruments = await loadCatalog();
const rows = await Promise.all(instruments.map(async instrument => {
  const history = JSON.parse(await readFile(new URL('history/' + instrument.isin + '.json', root), 'utf8'));
  const bars = history.bars || [];
  const latest = bars.at(-1);
  return { symbol: instrument.symbol, isin: instrument.isin, latestDate: latest?.date || null, open: latest?.open ?? null, close: latest?.close ?? null, changePct: latest?.open > 0 ? +((latest.close / latest.open - 1) * 100).toFixed(4) : null, records: bars.length };
}));
const dates = rows.map(x => x.latestDate).filter(Boolean);
const newestDate = dates.sort().at(-1) || null;
const missing = rows.filter(x => x.latestDate !== newestDate || x.open === null || x.close === null || x.changePct === null);
const report = { newestDate, active: rows.length, current: rows.length - missing.length, lagging: missing, checked: rows };
console.log('AMSTERDAM_LATEST_SESSION ' + JSON.stringify(report));
if (rows.length !== 80 || missing.length) process.exitCode = 1;
