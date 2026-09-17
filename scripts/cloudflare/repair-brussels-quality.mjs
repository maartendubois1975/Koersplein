import { FactoryApiClient } from './client.mjs';
import { cloudflareCatalog } from './catalog.mjs';
import { partitionBars } from './history-format.mjs';

const client = new FactoryApiClient();
const catalog = await cloudflareCatalog();
const requested = new Set(String(process.argv.find((arg) => arg.startsWith('--isins=')) || '').replace('--isins=', '').split(',').filter(Boolean));
const instruments = catalog.instruments.filter((item) => item.mic === 'XBRU' && (!requested.size || requested.has(item.isin)));
let repairedInstruments = 0;
let repairedBars = 0;

const numberOrNull = (value) => value === null || value === undefined || value === '' ? null : (Number.isFinite(Number(value)) ? Number(value) : null);

function repairBar(raw) {
  const bar = {
    date: String(raw.date),
    open: numberOrNull(raw.open), high: numberOrNull(raw.high), low: numberOrNull(raw.low),
    close: Number(raw.close), volume: numberOrNull(raw.volume),
    adjustedClose: numberOrNull(raw.adjustedClose ?? raw.adjusted_close)
  };
  let changed = false;
  if (bar.high !== null && bar.low !== null && bar.high < bar.low) {
    bar.high = null; bar.low = null; changed = true;
  }
  if (bar.high !== null && (bar.high < bar.close || (bar.open !== null && bar.high < bar.open))) {
    bar.high = null; changed = true;
  }
  if (bar.low !== null && (bar.low > bar.close || (bar.open !== null && bar.low > bar.open))) {
    bar.low = null; changed = true;
  }
  if (bar.open !== null && ((bar.high !== null && bar.open > bar.high) || (bar.low !== null && bar.open < bar.low))) {
    bar.open = null; changed = true;
  }
  return { bar, changed };
}

async function historyWithRetry(isin) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try { return await client.history(isin); }
    catch (error) {
      if (attempt === 5 || !/HTTP (429|500|502|503|504)/.test(error.message)) throw error;
      console.warn(JSON.stringify({ isin, status: 'RETRY', attempt, reason: error.message.split('\n')[0] }));
      await new Promise((resolve) => setTimeout(resolve, attempt * 5000));
    }
  }
}

for (const item of instruments) {
  const document = await historyWithRetry(item.isin);
  const repaired = document.bars.map(repairBar);
  const changed = repaired.filter((entry) => entry.changed).length;
  if (!changed) continue;
  const bars = repaired.map((entry) => entry.bar);
  const changedYears = new Set(repaired.filter((entry) => entry.changed).map((entry) => entry.bar.date.slice(0, 4)));
  for (const [period, rows] of partitionBars(bars)) {
    if (changedYears.has(period)) await client.putPartition(item.isin, period, { bars: rows, provider: document.provider?.id || 'quality-repair' });
  }
  await client.completeHistory(item.isin, { provider: document.provider?.id || 'quality-repair' });
  repairedInstruments += 1;
  repairedBars += changed;
  console.log(JSON.stringify({ isin: item.isin, status: 'REPAIRED', repairedBars: changed, years: [...changedYears] }));
}

console.log(JSON.stringify({ market: 'XBRU', catalogInstruments: instruments.length, repairedInstruments, repairedBars, policy: 'invalid-optional-ohlc-to-null' }, null, 2));
