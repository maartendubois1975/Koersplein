import {readFile} from 'node:fs/promises';
import {storageIdentityResolver} from './storage-identity.mjs';
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

export function manifestCoverage(markets, manifest) {
  const rows=Object.entries(manifest.instruments).map(([isin,row])=>({...row,isin}));
  const resolve=storageIdentityResolver(rows);
  const cutoff=new Date(Date.now()-7*86400000).toISOString().slice(0,10);
  const reports=markets.map(m=>{
    let withHistory=0,recent=0;
    for(const share of m.shares){
      const key=resolve({...share,mic:share.mic||m.mic});
      const row=key&&manifest.instruments[key];
      if(!row||!(Number(row.recordCount||row.records)>0)||!row.lastDate)continue;
      withHistory++;
      if(row.lastDate>=cutoff)recent++;
    }
    return {mic:m.mic,name:m.name,expected:m.shares.length,withHistory,recent,missing:m.shares.length-withHistory,stale:withHistory-recent};
  });
  const totals=Object.fromEntries(['expected','withHistory','recent','missing','stale'].map(k=>[k,reports.reduce((n,m)=>n+m[k],0)]));
  return {schemaVersion:3,generatedAt:new Date().toISOString(),evidence:'PUBLIC_LIVE_MANIFEST_READ_ONLY',warning:'Counts cover listings, including cross-listings, using MIC and ticker. Manifest metadata does not prove individual OHLC bars or complete history since 1990.',totals:{markets:reports.length,...totals},markets:reports};
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const plan=JSON.parse(await readFile(new URL('../../data/world-fill-plan.json',import.meta.url),'utf8'));
  const markets=[];
  for(const m of plan.markets.filter(m=>m.state==='COMPLETE')){
    const c=JSON.parse(await readFile(new URL(`../../data/euronext-${m.code}.json`,import.meta.url),'utf8'));
    markets.push({...m,shares:c.shares||c.instruments||[]});
  }
  const api=String(process.env.KOERSPLEIN_API_URL||'https://koersplein.maarten-dubois1975.workers.dev').replace(/\/$/,'');
  const response=await fetch(api+'/api/history/manifest.json',{signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('Public history manifest: HTTP '+response.status);
  const manifest=await response.json();
  if(!manifest?.instruments||typeof manifest.instruments!=='object')throw Error('Invalid public history manifest');
  console.log(JSON.stringify(manifestCoverage(markets,manifest),null,2));
}
