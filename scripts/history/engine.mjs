import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { YahooChartProvider } from './providers/yahoo-chart.mjs';

const rootUrl = new URL('../../', import.meta.url);
const dataUrl = new URL('data/', rootUrl);
const historyUrl = new URL('history/', dataUrl);
const statusUrl = new URL('status.json', historyUrl);
const providers = new Map([['yahoo-chart', new YahooChartProvider()]]);
const readJson = async (url, fallback = null) => { try { return JSON.parse(await readFile(url, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return fallback; throw error; } };
const nextDate = (date) => { const value = new Date(`${date}T00:00:00Z`); value.setUTCDate(value.getUTCDate() + 1); return value.toISOString().slice(0, 10); };
const today = () => new Date().toISOString().slice(0, 10);

export function validateBars(bars) {
  const seen = new Set();
  return bars.filter((bar) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bar.date) || seen.has(bar.date) || !Number.isFinite(bar.close) || bar.close <= 0) return false;
    if (Number.isFinite(bar.high) && Number.isFinite(bar.low) && bar.high < bar.low) return false;
    if (Number.isFinite(bar.high) && bar.high < bar.close) return false;
    if (Number.isFinite(bar.low) && bar.low > bar.close) return false;
    seen.add(bar.date);
    return true;
  }).sort((a, b) => a.date.localeCompare(b.date));
}

export function mergeBars(existing = [], incoming = []) {
  const byDate = new Map(existing.map((bar) => [bar.date, bar]));
  for (const bar of incoming) byDate.set(bar.date, { ...byDate.get(bar.date), ...bar });
  return validateBars([...byDate.values()]);
}

export function computeMovers(series) {
  return series.flatMap(({ instrument, bars, provider }) => {
    const valid = validateBars(bars);
    if (valid.length < 2) return [];
    const [previous, latest] = valid.slice(-2);
    return [{ isin: instrument.isin, name: instrument.name, symbol: instrument.symbol, exchange: instrument.market, mic: instrument.mic, country: instrument.country || null, close: latest.close, changePercent: ((latest.close / previous.close) - 1) * 100, tradingDate: latest.date, previousTradingDate: previous.date, provider }];
  }).sort((a, b) => b.changePercent - a.changePercent);
}

async function atomicWrite(url, value) {
  await mkdir(new URL('.', url), { recursive: true });
  const temp = new URL(`${url.pathname}.tmp-${process.pid}`, url);
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temp, url);
}

export async function loadCatalog() {
  const [shares, mappings] = await Promise.all([readJson(new URL('euronext-amsterdam.json', dataUrl)), readJson(new URL('history-instruments.json', dataUrl))]);
  const byIsin = new Map(shares.shares.map((share) => [share.isin, share]));
  return mappings.providerMappings.map((mapping) => {
    const share = byIsin.get(mapping.isin);
    if (!share || share.symbol !== mapping.symbol) throw new Error(`Identiteitskoppeling ongeldig voor ${mapping.isin}`);
    return { ...mapping, market: shares.exchange, mic: shares.mic, country: 'Nederland' };
  });
}

export async function syncInstrument(instrument, { mode = 'backfill' } = {}) {
  const provider = providers.get(instrument.provider);
  if (!provider) throw new Error(`Onbekende provider: ${instrument.provider}`);
  const fileUrl = new URL(`${instrument.isin}.json`, historyUrl);
  const existing = await readJson(fileUrl, null);
  const startDate = mode === 'update' && existing?.coverage?.lastDate ? nextDate(existing.coverage.lastDate) : '1990-01-01';
  const endDate = today();
  if (startDate > endDate) return { isin: instrument.isin, outcome: 'unchanged', records: existing.bars.length, firstDate: existing.coverage.firstDate, lastDate: existing.coverage.lastDate };
  const fetched = await provider.fetchDaily(instrument, { startDate, endDate });
  const bars = mergeBars(existing?.bars || [], fetched.bars);
  if (!bars.length) throw new Error(`Geen geldige dagkoersen voor ${instrument.isin}`);
  const volumeRecords = bars.filter((bar) => bar.volume !== null).length;
  const document = {
    schemaVersion: 1,
    instrument: { isin: instrument.isin, name: instrument.name, symbol: instrument.symbol, mic: instrument.mic, market: instrument.market, currency: instrument.currency, identitySource: instrument.identitySource },
    provider: { id: provider.id, name: provider.name, symbol: instrument.providerSymbol, retrievedAt: new Date().toISOString(), requestUrl: fetched.requestUrl, metadata: fetched.providerMeta, licenseNote: 'Publieke testfeed; commerciële herdistributierechten moeten vóór productie afzonderlijk worden vastgelegd.' },
    coverage: { firstDate: bars[0].date, lastDate: bars.at(-1).date, records: bars.length, volumeRecords, missingVolumeRecords: bars.length - volumeRecords },
    bars
  };
  await atomicWrite(fileUrl, document);
  const added = bars.length - (existing?.bars?.length || 0);
  return { isin: instrument.isin, outcome: added ? 'updated' : 'unchanged', added, records: bars.length, firstDate: bars[0].date, lastDate: bars.at(-1).date };
}

export async function runBatch(instruments, { mode = 'backfill', batchSize = 2 } = {}) {
  const checkpoint = await readJson(statusUrl, { schemaVersion: 1, instruments: {} });
  const results = [];
  for (let offset = 0; offset < instruments.length; offset += batchSize) {
    const batch = instruments.slice(offset, offset + batchSize);
    const settled = await Promise.allSettled(batch.map((instrument) => syncInstrument(instrument, { mode })));
    settled.forEach((item, index) => {
      const instrument = batch[index];
      const result = item.status === 'fulfilled' ? item.value : { isin: instrument.isin, outcome: 'error', error: item.reason?.message || String(item.reason) };
      checkpoint.instruments[instrument.isin] = { ...result, checkedAt: new Date().toISOString() };
      results.push(result);
    });
    checkpoint.updatedAt = new Date().toISOString();
    await atomicWrite(statusUrl, checkpoint);
  }
  return results;
}

export { historyUrl, readJson };
