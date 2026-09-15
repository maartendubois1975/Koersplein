import { readFile } from 'node:fs/promises';
import { transaction } from './db.mjs';

const dataUrl = new URL('../../data/', import.meta.url);
const readJson = async (name) => JSON.parse(await readFile(new URL(name, dataUrl), 'utf8'));

export async function seedAmsterdam(db) {
  const [catalog, indices, mappings] = await Promise.all([
    readJson('euronext-amsterdam.json'),
    readJson('euronext-amsterdam-indices.json'),
    readJson('history-instruments.json')
  ]);
  const groupByIsin = new Map();
  for (const index of indices.indices) for (const member of index.constituents) groupByIsin.set(member.isin, index.displayName);
  const mappingByIsin = new Map(mappings.providerMappings.map((item) => [item.isin, item]));
  const now = new Date().toISOString();

  transaction(db, () => {
    db.prepare(`INSERT INTO markets(name, mic, country, currency, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(mic) DO UPDATE SET name=excluded.name, country=excluded.country, currency=excluded.currency, updated_at=excluded.updated_at`)
      .run(catalog.exchange, catalog.mic, 'Nederland', 'EUR', now, now);
    const market = db.prepare('SELECT id FROM markets WHERE mic = ?').get(catalog.mic);
    const upsert = db.prepare(`INSERT INTO instruments(company, ticker, isin, mic, market_id, index_group, active, provider_symbol, identity_source, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
      ON CONFLICT(isin) DO UPDATE SET company=excluded.company, ticker=excluded.ticker, mic=excluded.mic,
      market_id=excluded.market_id, index_group=excluded.index_group, provider_symbol=COALESCE(excluded.provider_symbol, instruments.provider_symbol),
      identity_source=COALESCE(excluded.identity_source, instruments.identity_source), active=1, updated_at=excluded.updated_at`);
    const ensureStatus = db.prepare(`INSERT INTO history_status(instrument_id, status, updated_at)
      VALUES (?, 'MISSING', ?) ON CONFLICT(instrument_id) DO NOTHING`);
    for (const share of catalog.shares) {
      const mapping = mappingByIsin.get(share.isin);
      upsert.run(share.name, share.symbol, share.isin, catalog.mic, market.id, groupByIsin.get(share.isin) || 'Overig', mapping?.providerSymbol || null, mapping?.identitySource || null, now, now);
      ensureStatus.run(db.prepare('SELECT id FROM instruments WHERE isin = ?').get(share.isin).id, now);
    }
  });
  return { instruments: catalog.shares.length, mic: catalog.mic };
}

export function getInstrument(db, isin) {
  return db.prepare(`SELECT i.*, m.name AS market, m.country, m.currency
    FROM instruments i JOIN markets m ON m.id=i.market_id WHERE i.isin=?`).get(isin);
}
