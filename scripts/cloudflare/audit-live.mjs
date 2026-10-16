import { cloudflareCatalog } from './catalog.mjs';
import { FactoryApiClient } from './client.mjs';

export function compareCloudflareCoverage(expected, liveCatalog, manifest) {
  if (!Array.isArray(liveCatalog?.instruments) || !manifest?.instruments || typeof manifest.instruments !== 'object') {
    throw new Error('Ongeldig antwoord van de live Cloudflare API');
  }
  const live = new Map(liveCatalog.instruments.map(x => [x.isin,x]));
  const registeredMarketMics = Array.isArray(liveCatalog.markets) ? new Set(liveCatalog.markets.map(x => x.mic)) : null;
  const history = manifest.instruments;
  const expectedByMic = new Map(expected.markets.map(x => [x.mic,{ mic:x.mic, expected:0, registered:0, withHistory:0, bars:0, missing:[] }]));
  for (const item of expected.instruments) {
    const row = expectedByMic.get(item.mic);
    row.expected++;
    const registered = live.get(item.isin);
    if (!registered || registered.mic !== item.mic) {
      row.missing.push(item.isin);
      continue;
    }
    row.registered++;
    const h = history[item.isin];
    if (h && Number(h.recordCount || h.records || 0)>0) {
      row.withHistory++;
      row.bars += Number(h.recordCount || h.records);
    }
  }
  const markets = [...expectedByMic.values()].map(row => ({...row, marketRegistered:registeredMarketMics ? registeredMarketMics.has(row.mic) : null }));
  return { schemaVersion:1, generatedAt:new Date().toISOString(), evidence:'LIVE_CLOUDFLARE_READ_ONLY',
    warning:'History counts reflect API manifest status, not independently verified daily bars or full backfill.',
    unresolvedWithoutIsin:expected.unresolved.length,
    missingMarkets:registeredMarketMics ? markets.filter(x=>!x.marketRegistered).map(x=>x.mic) : null,
    totals:{ markets:markets.length, registeredMarkets:registeredMarketMics ? markets.filter(x=>x.marketRegistered).length : null, expected:markets.reduce((n,x)=>n+x.expected,0),
      registered:markets.reduce((n,x)=>n+x.registered,0),
      withHistory:markets.reduce((n,x)=>n+x.withHistory,0),
      reportedBars:markets.reduce((n,x)=>n+x.bars,0)},
    markets };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const client = new FactoryApiClient();
  const expected = await cloudflareCatalog();
  const [liveCatalog, manifest] = await Promise.all([client.catalog(),client.historyManifest()]);
  console.log(JSON.stringify(compareCloudflareCoverage(expected,liveCatalog,manifest),null,2));
}
