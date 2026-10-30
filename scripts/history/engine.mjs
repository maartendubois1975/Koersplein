import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createDefaultProviderRegistry } from './provider-registry.mjs';

const rootUrl = new URL('../../', import.meta.url);
const dataUrl = new URL('data/', rootUrl);
const historyUrl = new URL('history/', dataUrl);
const statusUrl = new URL('status.json', historyUrl);
const providers = createDefaultProviderRegistry();
const readJson = async (url, fallback = null) => { try { return JSON.parse(await readFile(url, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return fallback; throw error; } };
const today = () => new Date().toISOString().slice(0, 10);

export function validateBars(bars) {
  const seen = new Set();
  return bars.filter((bar) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bar.date) || seen.has(bar.date) || !Number.isFinite(bar.open) || bar.open <= 0 || !Number.isFinite(bar.close) || bar.close <= 0) return false;
    if (Number.isFinite(bar.high) && Number.isFinite(bar.low) && bar.high < bar.low) return false;
    if (Number.isFinite(bar.high) && (bar.high < bar.close || bar.high < bar.open)) return false;
    if (Number.isFinite(bar.low) && (bar.low > bar.close || bar.low > bar.open)) return false;
    seen.add(bar.date);
    return true;
  }).sort((a, b) => a.date.localeCompare(b.date));
}

export function mergeBars(existing = [], incoming = []) {
  // A broken provider response must never overwrite a previously valid bar.
  // Validate incoming records before applying them, rather than dropping the
  // entire merged date after an invalid overwrite.
  const byDate = new Map(validateBars(existing).map(bar => [bar.date, bar]));
  for (const bar of incoming) {
    if (!bar || typeof bar.date !== 'string') continue;
    const merged = { ...byDate.get(bar.date), ...bar };
    if (validateBars([merged]).length === 1) byDate.set(bar.date, merged);
  }
  return validateBars([...byDate.values()]);
}

// Movers must refer to the same latest observed trading session. Older last
// trades remain visible in history but must not be ranked as today's movers.
// An explicit targetSession allows callers to enforce an official session date.
export function computeMovers(series, { targetSession = null } = {}) {
  const prepared = series.map(({ instrument, bars, provider }) => {
    const valid = validateBars(bars);
    return { instrument, provider, valid, latest: valid.at(-1) };
  });
  const session = targetSession || prepared.map(x => x.latest?.date).filter(Boolean).sort().at(-1);
  if (!session || !/^\d{4}-\d{2}-\d{2}$/.test(session)) return [];
  return prepared.flatMap(({ instrument, provider, valid, latest }) => {
    if (valid.length < 2 || latest?.date !== session) return [];
    const previous = valid.at(-2);
    // A gap can indicate a trading suspension or missing provider sessions.
    // Do not mislabel an arbitrarily old comparison as a one-day movement.
    const gapDays = (Date.parse(latest.date + 'T00:00:00Z') - Date.parse(previous.date + 'T00:00:00Z')) / 86400000;
    if (!Number.isFinite(gapDays) || gapDays > 4 || gapDays < 1) return [];
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
  return mappings.providerMappings.filter((mapping) => !['unverified-amsterdam-trading', 'canonical-on-other-market'].includes(byIsin.get(mapping.isin)?.historyStatus)).map((mapping) => {
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
  if (mode === 'backfill' && existing?.coverage?.backfillComplete) {
    return { isin: instrument.isin, outcome: 'unchanged', reason: 'backfill-complete', providerRequest: false, records: existing.bars.length, firstDate: existing.coverage.firstDate, lastDate: existing.coverage.lastDate };
  }
  // Refresh the latest stored trading session as well: an intraday candle can
  // change until the official close, and providers may correct the last bar.
  const startDate = mode === 'update' && existing?.coverage?.lastDate ? existing.coverage.lastDate : (mode === 'update' && instrument.provider === 'euronext-live' ? '2026-10-01' : '1990-01-01');
  const endDate = today();
  if (startDate > endDate) return { isin: instrument.isin, outcome: 'unchanged', reason: 'already-current', providerRequest: false, records: existing.bars.length, firstDate: existing.coverage.firstDate, lastDate: existing.coverage.lastDate };
  // Euronext is the primary daily source for XAMS; retain the verified Yahoo
  // mapping as fallback and historical backfill source. Do not mix source
  // attribution: record the provider actually used for this refresh.
  let usedProvider = provider;
  let fetched;
  if (mode === 'update' && instrument.mic === 'XAMS') {
    const official = providers.get('euronext-live');
    try {
      fetched = await official.fetchDaily(instrument, { startDate, endDate });
      if (fetched.providerMeta?.partialHistory) throw new Error('Incomplete official Euronext window');
      usedProvider = official;
    } catch (officialError) {
      fetched = await provider.fetchDaily(instrument, { startDate, endDate });
      fetched.providerMeta = { ...fetched.providerMeta, officialFallbackReason: officialError.message };
    }
  } else {
    fetched = await provider.fetchDaily(instrument, { startDate, endDate });
  }
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
    coverage: { firstDate: bars[0].date, lastDate: bars.at(-1).date, records: bars.length, volumeRecords, missingVolumeRecords: bars.length - volumeRecords, backfillComplete: mode === 'backfill' || existing?.coverage?.backfillComplete === true },
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
