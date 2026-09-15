import { FactoryApiClient } from './client.mjs';
import { createDefaultProviderRegistry } from '../history/provider-registry.mjs';
import { partitionBars } from './history-format.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((item) => item.replace(/^--/, '').split('=')));
const jobId = args['job-id'] || process.env.KOERSPLEIN_JOB_ID;
const batchSize = Math.max(1, Math.min(100, Number(args['batch-size'] || process.env.KOERSPLEIN_BATCH_SIZE || 25)));
const mode = String(args.mode || process.env.KOERSPLEIN_RUN_MODE || 'canary').toLowerCase();
if (!['canary', 'mass'].includes(mode)) throw new Error('--mode moet canary of mass zijn');
const requestedMax = Number(args['max-items'] || process.env.KOERSPLEIN_MAX_ITEMS || (mode === 'mass' ? 500 : 2));
const maxItems = Math.max(1, Math.min(mode === 'mass' ? 5000 : 2, Number.isFinite(requestedMax) ? requestedMax : (mode === 'mass' ? 500 : 2)));
if (!jobId) throw new Error('--job-id is vereist');
const client = new FactoryApiClient();
const registry = createDefaultProviderRegistry();
const addDay = (date) => { const value = new Date(`${date}T00:00:00Z`); value.setUTCDate(value.getUTCDate() + 1); return value.toISOString().slice(0, 10); };
const today = () => new Date().toISOString().slice(0, 10);

async function processItem(job, item) {
  const base = { isin: item.isin, name: item.company, symbol: item.ticker, ticker: item.ticker, mic: item.mic, market: item.mic, currency: item.currency, provider: 'yahoo-chart', providerSymbol: `${item.ticker}.AS` };
  if (job.type === 'CHECK_AMSTERDAM') return { recordsAdded: 0, firstDate: item.first_date, lastDate: item.last_date };
  if (job.type === 'VALIDATE_HISTORY') {
    if (!item.record_count) throw new Error('Nog geen historie');
    const document = await client.history(item.isin);
    if (document.bars.length !== item.record_count) throw new Error('Recordaantal wijkt af van metadata');
    return { recordsAdded: 0, firstDate: document.coverage.firstDate, lastDate: document.coverage.lastDate };
  }
  if (job.type === 'REPAIR_MISSING' && item.history_status === 'COMPLETE') return { recordsAdded: 0, firstDate: item.first_date, lastDate: item.last_date };
  if (job.type === 'HISTORY_BACKFILL' && item.history_status === 'COMPLETE') return { recordsAdded: 0, firstDate: item.first_date, lastDate: item.last_date };
  const startDate = item.last_date ? addDay(item.last_date) : '1990-01-01';
  if (startDate > today()) return { recordsAdded: 0, firstDate: item.first_date, lastDate: item.last_date };
  const { provider, result } = await registry.fetchDaily(base, { startDate, endDate: today() }, base.provider);
  let added = 0;
  for (const [period, bars] of partitionBars(result.bars)) { await client.putPartition(item.isin, period, { bars, provider: provider.id }); added += bars.length; }
  const coverage = await client.completeHistory(item.isin, { provider: provider.id });
  return { recordsAdded: added, firstDate: coverage.first_date, lastDate: coverage.last_date };
}

const job = await client.job(jobId);
if (!job) throw new Error(`Job ${jobId} bestaat niet`);
let processedThisRun = 0;
let failedThisRun = 0;
console.log(JSON.stringify({ jobId, mode, maxItems, batchSize, safetyGate: mode === 'canary' ? 'CANARY_MAX_2' : 'MASS_BOUNDED' }));
while (processedThisRun < maxItems) {
  const claimLimit = Math.min(batchSize, maxItems - processedThisRun);
  const { items } = await client.claim(jobId, claimLimit);
  if (!items.length) break;
  for (const item of items) {
    try {
      const result = await processItem(job, item);
      await client.finishItem(jobId, item.isin, { status: 'COMPLETE', ...result });
      console.log(JSON.stringify({ jobId, isin: item.isin, status: 'COMPLETE', ...result }));
    } catch (error) {
      failedThisRun += 1;
      await client.finishItem(jobId, item.isin, { status: 'FAILED', error: error.message });
      console.error(JSON.stringify({ jobId, isin: item.isin, status: 'FAILED', error: error.message }));
    }
    processedThisRun += 1;
  }
}
const finalJob = await client.job(jobId);
console.log(JSON.stringify({ ...finalJob, run: { mode, processedThisRun, failedThisRun, maxItems } }, null, 2));
if (failedThisRun > 0) throw new Error(`${failedThisRun} instrument(en) mislukt in ${mode}-run; vervolg is geblokkeerd`);
