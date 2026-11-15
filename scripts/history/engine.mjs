import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { createDefaultProviderRegistry } from './provider-registry.mjs';

const rootUrl = new URL('../../', import.meta.url);
const dataUrl = new URL('data/', rootUrl);
const historyUrl = new URL('history/', dataUrl);
const statusUrl = new URL('status.json', historyUrl);
const providers = createDefaultProviderRegistry();
const readJson = async (url, fallback = null) => { try { return JSON.parse(await readFile(url, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return fallback; throw error; } };
const today = () => new Date().toISOString().slice(0, 10);

import { validateBars, mergeBars, verifiedBackfillComplete } from './bars.mjs';
export { validateBars, mergeBars, verifiedBackfillComplete, computeMovers } from './bars.mjs';
import { loadCompanyCatalog } from './company-register.mjs';
import { fetchConfiguredHistory } from './source-policy.mjs';

async function atomicWrite(url, value) {
  await mkdir(new URL('.', url), { recursive: true });
  const temp = new URL(`${url.pathname}.tmp-${process.pid}`, url);
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temp, url);
}

export async function loadCatalog() {
  const shares = await loadCompanyCatalog('XAMS');
  const mappings = await readJson(new URL('history-instruments.json', dataUrl));
  const byIsin = new Map(shares.shares.map(share => [share.isin, share]));
  if (mappings.providerMappings.length !== shares.shares.length) throw Error('Incomplete Amsterdam mappings');
  const seen = new Set();
  return mappings.providerMappings.map(mapping => {
    const share = byIsin.get(mapping.isin);
    if (!share || share.symbol !== mapping.symbol || seen.has(mapping.isin)) throw Error(`Identiteitskoppeling ongeldig voor ${mapping.isin}`);
    seen.add(mapping.isin);
    return { ...mapping, market: shares.exchange, mic: shares.mic, country: 'Nederland' };
  });
}

export async function syncInstrument(instrument, { mode = 'backfill' } = {}) {
  const provider = providers.get(instrument.provider);
  if (!provider) throw new Error(`Onbekende provider: ${instrument.provider}`);
  const fileUrl = new URL(`${instrument.isin}.json`, historyUrl);
  const existing = await readJson(fileUrl, null);
  if (existing && validateBars(existing.bars || []).length !== existing.bars?.length) throw Error('Archived history requires read-only review before refresh: '+instrument.isin);
  if (mode === 'backfill' && verifiedBackfillComplete(existing)) {
    return { isin: instrument.isin, outcome: 'unchanged', reason: 'backfill-complete', providerRequest: false, records: existing.bars.length, firstDate: existing.coverage.firstDate, lastDate: existing.coverage.lastDate };
  }
  // Refresh the latest stored trading session as well: an intraday candle can
  // change until the official close, and providers may correct the last bar.
  const startDate = mode === 'update' && existing?.coverage?.lastDate ? existing.coverage.lastDate : (mode === 'update' && instrument.provider === 'euronext-live' ? '2026-10-01' : '1990-01-01');
  const endDate = today();
  if (startDate > endDate) return { isin: instrument.isin, outcome: 'unchanged', reason: 'already-current', providerRequest: false, records: existing.bars.length, firstDate: existing.coverage.firstDate, lastDate: existing.coverage.lastDate };
  const { provider: usedProvider, result: fetched } = await fetchConfiguredHistory(
    providers, instrument, { startDate, endDate }, { mode });
  const existingByDate = new Map((existing?.bars || []).map(bar => [bar.date, bar]));
  const incoming = fetched.bars.map(bar => ({ ...bar, ...(bar.adjustedClose == null ? { adjustedClose: existingByDate.get(bar.date)?.adjustedClose ?? null } : {}) }));
  const bars = mergeBars(existing?.bars || [], incoming);
  // Euronext requests adjusted=Y; its adjustment scope is not verified.
  // Never erase historical adjustedClose values when refreshing a recent
  // session. Retained values remain UNVERIFIED and cannot feed returns/models.
  // mergeBars preserves existing values for dates not present in the refresh.
  if (!bars.length) throw new Error(`Geen geldige dagkoersen voor ${instrument.isin}`);
  const volumeRecords = bars.filter((bar) => bar.volume !== null).length;
  const document = {
    schemaVersion: 1,
    instrument: { isin: instrument.isin, name: instrument.name, symbol: instrument.symbol, mic: instrument.mic, market: instrument.market, currency: instrument.currency, identitySource: instrument.identitySource },
    provider: { id: usedProvider.id, name: usedProvider.name, symbol: usedProvider.id === 'euronext-live' ? instrument.isin+'-'+instrument.mic : instrument.providerSymbol, retrievedAt: new Date().toISOString(), requestUrl: fetched.requestUrl, metadata: { ...fetched.providerMeta, ...(instrument.mic === 'XAMS' && usedProvider.id === 'euronext-live' ? { adjustmentStatus: 'EURONEXT_ADJUSTED_Y_UNVERIFIED_SCOPE', adjustedCloseSource: null } : {}) }, licenseNote: 'Publieke testfeed; commerciële herdistributierechten moeten vóór productie afzonderlijk worden vastgelegd.' },
    coverage: { firstDate: bars[0].date, lastDate: bars.at(-1).date, records: bars.length, volumeRecords, missingVolumeRecords: bars.length - volumeRecords, backfillComplete: verifiedBackfillComplete(existing, fetched.providerMeta) },
    bars
  };
  if (!existing || JSON.stringify(existing.bars) !== JSON.stringify(bars)) await atomicWrite(fileUrl, document);
  const added = bars.length - (existing?.bars?.length || 0);
  return { isin: instrument.isin, outcome: added ? 'updated' : 'unchanged', added, providerRequest: true, records: bars.length, firstDate: bars[0].date, lastDate: bars.at(-1).date };
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
