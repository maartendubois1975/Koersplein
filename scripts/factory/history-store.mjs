import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { transaction } from './db.mjs';
import { getInstrument } from './catalog.mjs';
import { validateBars } from '../history/engine.mjs';

export function refreshHistoryStatus(db, instrumentId, { provider = null, error = null, status = null } = {}) {
  const aggregate = db.prepare(`SELECT MIN(trading_date) firstDate, MAX(trading_date) lastDate, COUNT(*) records,
    MAX(provider) provider FROM daily_prices WHERE instrument_id=?`).get(instrumentId);
  const now = new Date().toISOString();
  const current = db.prepare('SELECT status FROM history_status WHERE instrument_id=?').get(instrumentId);
  const nextStatus = error ? 'ERROR' : aggregate.records ? (status || (current?.status === 'COMPLETE' ? 'COMPLETE' : 'PARTIAL')) : 'MISSING';
  db.prepare(`INSERT INTO history_status(instrument_id, first_available_date, last_available_date, record_count, provider, status, last_checked, error, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(instrument_id) DO UPDATE SET first_available_date=excluded.first_available_date,
    last_available_date=excluded.last_available_date, record_count=excluded.record_count, provider=excluded.provider,
    status=excluded.status, last_checked=excluded.last_checked, error=excluded.error, updated_at=excluded.updated_at`)
    .run(instrumentId, aggregate.firstDate, aggregate.lastDate, aggregate.records, provider || aggregate.provider, nextStatus, now, error, now);
  return { ...aggregate, status:nextStatus, error };
}

export function storeBars(db, instrument, bars, provider, metadata = {}, { complete = false } = {}) {
  const valid = validateBars(bars);
  const now = new Date().toISOString();
  let added = 0;
  transaction(db, () => {
    const insert = db.prepare(`INSERT INTO daily_prices(instrument_id, trading_date, open, high, low, close, volume, adjusted_close, provider, provider_metadata, imported_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(instrument_id, trading_date) DO NOTHING`);
    for (const bar of valid) {
      const result = insert.run(instrument.id, bar.date, bar.open, bar.high, bar.low, bar.close, bar.volume, bar.adjustedClose, provider, JSON.stringify(metadata), now);
      added += Number(result.changes);
    }
    refreshHistoryStatus(db, instrument.id, { provider, status:complete ? 'COMPLETE' : null });
  });
  return { valid: valid.length, added, ...refreshHistoryStatus(db, instrument.id, { provider, status:complete ? 'COMPLETE' : null }) };
}

export async function importHistoryDocument(db, document) {
  const instrument = getInstrument(db, document.instrument.isin);
  if (!instrument) throw new Error(`Onbekend instrument ${document.instrument.isin}`);
  if (instrument.ticker !== document.instrument.symbol || instrument.mic !== document.instrument.mic) throw new Error(`Historie-identiteit wijkt af voor ${instrument.isin}`);
  return storeBars(db, instrument, document.bars, document.provider.id, {
    sourceName: document.provider.name,
    retrievedAt: document.provider.retrievedAt,
    technicalTestSource: true
  }, { complete:document.coverage?.backfillComplete === true });
}

export async function importGoldenHistory(db, sourceDir) {
  const results = {};
  for (const isin of ['NL0010273215', 'NL0012969182']) {
    const document = JSON.parse(await readFile(join(sourceDir, `${isin}.json`), 'utf8'));
    results[isin] = await importHistoryDocument(db, document);
  }
  return results;
}

export function historyDocument(db, isin) {
  const instrument = getInstrument(db, isin);
  if (!instrument) return null;
  const status = db.prepare('SELECT * FROM history_status WHERE instrument_id=?').get(instrument.id);
  if (!status?.record_count) return null;
  const bars = db.prepare(`SELECT trading_date date, open, high, low, close, adjusted_close adjustedClose, volume
    FROM daily_prices WHERE instrument_id=? ORDER BY trading_date`).all(instrument.id);
  return {
    schemaVersion: 1,
    instrument: { isin: instrument.isin, name: instrument.company, symbol: instrument.ticker, mic: instrument.mic, market: instrument.market, currency: instrument.currency, identitySource: instrument.identity_source },
    provider: { id: status.provider, name: status.provider === 'yahoo-chart' ? 'Yahoo Finance chart feed' : status.provider, retrievedAt: status.last_checked, metadata: { datastore: 'Koersplein SQLite' }, licenseNote: 'Technische testfeed; commerciële herdistributierechten moeten vóór productie worden vastgelegd.' },
    coverage: { firstDate: status.first_available_date, lastDate: status.last_available_date, records: status.record_count, volumeRecords: bars.filter((bar) => bar.volume !== null).length, missingVolumeRecords: bars.filter((bar) => bar.volume === null).length, backfillComplete: status.status === 'COMPLETE' },
    bars
  };
}

export function historyManifest(db) {
  const rows = db.prepare(`SELECT i.isin, i.ticker symbol, i.mic, h.first_available_date firstDate,
    h.last_available_date lastDate, h.record_count records, h.provider
    FROM instruments i JOIN history_status h ON h.instrument_id=i.id WHERE h.record_count > 0 ORDER BY i.isin`).all();
  return { schemaVersion: 1, generatedAt: new Date().toISOString(), instruments: Object.fromEntries(rows.map((row) => [row.isin, { ...row, file: `${row.isin}.json` }])) };
}
