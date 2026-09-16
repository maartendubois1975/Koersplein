import { FactoryApiClient } from './client.mjs';
import { cloudflareCatalog } from './catalog.mjs';
import { createDefaultProviderRegistry } from '../history/provider-registry.mjs';
import { partitionBars } from './history-format.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((item) => item.replace(/^--/, '').split('=')));
const offset = Math.max(0, Number(args.offset || 0));
const limit = Math.max(1, Math.min(250, Number(args.limit || 250)));
const strict = String(args.strict || 'false') === 'true';
const client = new FactoryApiClient();
const registry = createDefaultProviderRegistry();
const catalog = await cloudflareCatalog();
await client.seedCatalog(catalog);
const today = () => new Date().toISOString().slice(0, 10);
const addDay = (date) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
const selected = catalog.instruments.slice(offset, offset + limit);
let complete = 0, failed = 0, unchanged = 0;

for (const item of selected) {
  try {
    let existing = null;
    try { existing = await client.history(item.isin); } catch (error) { if (!String(error.message).includes('HTTP 404')) throw error; }
    const startDate = existing?.coverage?.lastDate ? addDay(existing.coverage.lastDate) : '1990-01-01';
    if (startDate > today()) { unchanged += 1; console.log(JSON.stringify({ isin: item.isin, status: 'UNCHANGED' })); continue; }
    const base = { ...item, name: item.company, symbol: item.ticker, market: item.mic };
    const { provider, result } = await registry.fetchDaily(base, { startDate, endDate: today() }, item.provider || 'yahoo-chart');
    if (!result.bars.length && !existing?.coverage?.recordCount) throw new Error('Geen koershistorie ontvangen');
    for (const [period, bars] of partitionBars(result.bars)) await client.putPartition(item.isin, period, { bars, provider: provider.id });
    const coverage = await client.completeHistory(item.isin, { provider: provider.id });
    complete += 1;
    console.log(JSON.stringify({ isin: item.isin, status: 'COMPLETE', records: coverage.record_count, firstDate: coverage.first_date, lastDate: coverage.last_date }));
  } catch (error) {
    failed += 1;
    console.error(JSON.stringify({ isin: item.isin, status: 'FAILED', error: error.message }));
  }
}
console.log(JSON.stringify({ market: 'XAMS', offset, selected: selected.length, complete, unchanged, failed }, null, 2));
if (strict && failed) throw new Error(`${failed} instrument(en) mislukt in canary`);
