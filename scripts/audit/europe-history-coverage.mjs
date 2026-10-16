import { existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function coverageReport(db, expectedMarkets = []) {
  const rows = db.prepare(`SELECT m.mic, COUNT(i.id) instruments,
    SUM(CASE WHEN COALESCE(h.record_count,0)>0 THEN 1 ELSE 0 END) withHistory,
    SUM(CASE WHEN h.status='COMPLETE' THEN 1 ELSE 0 END) markedComplete,
    COALESCE(SUM(h.record_count),0) reportedBars,
    MIN(h.first_available_date) earliestDate,
    MAX(h.last_available_date) latestDate
    FROM markets m LEFT JOIN instruments i ON i.market_id=m.id
    LEFT JOIN history_status h ON h.instrument_id=i.id
    GROUP BY m.id,m.mic ORDER BY m.mic`).all();
  const byMic = new Map(rows.map(row => [row.mic, row]));
  const markets = expectedMarkets.map(mic => byMic.get(mic) || {
    mic, instruments:0, withHistory:0, markedComplete:0,
    reportedBars:0, earliestDate:null, latestDate:null
  });
  return { schemaVersion:1, evidence:'LOCAL_SQLITE_ONLY', generatedAt:new Date().toISOString(),
    warning:'Catalog COMPLETE is not historical coverage; database may differ from live Cloudflare/production storage.',
    markets, totals:{markets:markets.length, registeredInDatabase:markets.filter(x=>x.instruments>0).length,
      instruments:markets.reduce((n,x)=>n+x.instruments,0),
      withHistory:markets.reduce((n,x)=>n+x.withHistory,0),
      markedComplete:markets.reduce((n,x)=>n+x.markedComplete,0),
      reportedBars:markets.reduce((n,x)=>n+x.reportedBars,0)}
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = process.argv[2] || process.env.KOERSPLEIN_DATABASE_PATH;
  if (!file || !existsSync(file)) {
    console.error('Geef het pad naar een BESTAANDE SQLite-database. Er wordt geen lege database aangemaakt.');
    process.exitCode = 2;
  } else {
    const { readFileSync } = await import('node:fs');
    const { join, dirname } = await import('node:path');
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
    const markets = JSON.parse(readFileSync(join(root,'data/markets.json'),'utf8')).venues.find(x=>x.id==='euronext').markets;
    const db = new DatabaseSync(resolve(file), { readOnly:true });
    try { console.log(JSON.stringify(coverageReport(db,markets.map(x=>x.mic)),null,2)); }
    finally { db.close(); }
  }
}
