import fs from 'node:fs/promises';
import { FactoryApiClient } from './client.mjs';
import { createDefaultProviderRegistry } from '../history/provider-registry.mjs';
import { partitionBars } from './history-format.mjs';

const client = new FactoryApiClient();
const registry = createDefaultProviderRegistry();
const raw = JSON.parse(await fs.readFile('data/euronext-paris.json', 'utf8'));
const instruments = (raw.shares || []).map((x) => ({
  isin: x.isin,
  name: x.name,
  company: x.name,
  symbol: x.symbol,
  ticker: x.symbol,
  mic: 'XPAR',
  market: 'XPAR',
  currency: 'EUR',
  countryCode: 'FR',
  provider: 'yahoo-chart'
}));
if (instruments.length < 2) throw new Error('Parijse catalogus te klein');

// instruments.mic is a foreign key to markets.mic. Register the market in the
// same catalog request before inserting any Parijse instruments.
await client.seedCatalog({
  markets: [{
    mic: 'XPAR',
    code: 'paris',
    name: 'Euronext Paris',
    exchangeGroup: 'Euronext',
    countryCode: 'FR',
    currency: 'EUR',
    timezone: 'Europe/Paris'
  }],
  instruments
});

const today = new Date().toISOString().slice(0, 10);
let complete = 0, failed = 0;
for (const item of instruments.slice(0, 2)) {
  try {
    const { provider, result } = await registry.fetchDaily(item, { startDate: '1990-01-01', endDate: today }, 'yahoo-chart');
    if (!result.bars.length) throw new Error('Geen koershistorie ontvangen');
    for (const [period, bars] of partitionBars(result.bars)) await client.putPartition(item.isin, period, { bars, provider: provider.id });
    const coverage = await client.completeHistory(item.isin, { provider: provider.id });
    complete++;
    console.log(JSON.stringify({ isin: item.isin, symbol: item.symbol, status: 'COMPLETE', records: coverage.record_count, firstDate: coverage.first_date, lastDate: coverage.last_date }));
  } catch (error) {
    failed++;
    console.error(JSON.stringify({ isin: item.isin, symbol: item.symbol, status: 'FAILED', error: error.message }));
  }
}
console.log(JSON.stringify({ market: 'XPAR', catalog: instruments.length, canary: 2, complete, failed }, null, 2));
if (failed) process.exitCode = 2;
