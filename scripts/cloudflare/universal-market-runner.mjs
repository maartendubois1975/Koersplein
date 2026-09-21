import fs from 'node:fs/promises';
import { FactoryApiClient } from './client.mjs';
import { createDefaultProviderRegistry } from '../history/provider-registry.mjs';
import { partitionBars } from './history-format.mjs';

const client=new FactoryApiClient();
const sourceRegistry=JSON.parse(await fs.readFile('data/market-source-registry.json','utf8'));
const registry=createDefaultProviderRegistry();
const plan=JSON.parse(await fs.readFile('data/world-fill-plan.json','utf8'));
const mic=process.env.MARKET_MIC||plan.markets.find(x=>x.state==='ACTIVE')?.mic||plan.markets[0]?.mic;
const m=plan.markets.find(x=>x.mic===mic);if(!m)throw new Error(`MARKET_MIC ${mic} niet in actief plan`);
const sourcePlan=sourceRegistry.markets?.[mic];if(!sourcePlan||sourcePlan.status!=='APPROVED'||!sourcePlan.historySources?.some(x=>x.role==='PRIMARY')||(sourcePlan.discovery?.testedDifficultSymbols||0)<10)throw new Error(`BRONONDERZOEK VERPLICHT vóór backfill van ${mic}`);
const path=`data/euronext-${m.code}.json`;
const raw=JSON.parse(await fs.readFile(path,'utf8'));
const source=raw.shares||raw.instruments||[];if(!source.length)throw new Error('lege catalogus');
const instruments=source.map(x=>({isin:x.isin,name:x.name||x.company,company:x.name||x.company,symbol:x.symbol||x.ticker,ticker:x.symbol||x.ticker,mic:x.mic||m.mic,market:x.mic||m.mic,currency:m.currency,countryCode:m.country,provider:'yahoo-chart'}));
let unavailable=new Set();
if(mic==='XPAR')try{const rr=JSON.parse(await fs.readFile('research/output/paris/repair-invalid-summary.json','utf8'));unavailable=new Set((rr.unavailableItems||[]).map(x=>x.isin))}catch{}
// Register every MIC present in the official catalogue before inserting instruments.
const marketMics=[...new Set(instruments.map(x=>x.mic).filter(Boolean))];
const markets=marketMics.map(segmentMic=>({
  mic:segmentMic,
  code:segmentMic===m.mic?m.code:`${m.code}-${segmentMic.toLowerCase()}`,
  name:segmentMic===m.mic?m.name:`${m.name} (${segmentMic})`,
  exchangeGroup:'world',
  countryCode:m.country,
  currency:m.currency,
  timezone:m.timezone
}));
const seedCatalog=process.env.SEED_CATALOG!=='0';
if(seedCatalog){
  await client.seedCatalog({markets,instruments:[]});
  const cb=Number(process.env.CATALOG_BATCH_SIZE||25);
  for(let i=0;i<instruments.length;i+=cb)await client.seedCatalog({markets:[],instruments:instruments.slice(i,i+cb)});
}
const hb=Number(process.env.HISTORY_BATCH_SIZE||10),today=new Date().toISOString().slice(0,10);
const freshnessCutoff=new Date(Date.now()-7*86400000).toISOString().slice(0,10);
// A daily series is current when it reaches the last fully closed trading weekday.
// Never require today's bar while the trading day is still open: that reselects the
// same already-filled instruments on weekday runs (notably Monday before Milan closes).
const latestExpectedTradingDate=(()=>{const d=new Date(`${today}T12:00:00Z`);do{d.setUTCDate(d.getUTCDate()-1)}while(d.getUTCDay()===0||d.getUTCDay()===6);return d.toISOString().slice(0,10)})();
const runSkip=new Set(String(process.env.SKIP_ISINS||'').split(',').map(x=>x.trim()).filter(Boolean));
const candidates=[];let alreadyCurrent=0,excluded=0,inspectionFailed=0,skippedRunFailures=0;
for(const item of instruments){
  if(unavailable.has(item.isin)){excluded++;continue}
  if(runSkip.has(item.isin)){skippedRunFailures++;continue}
  try{const h=await client.history(item.isin);const last=h?.coverage?.lastDate||h?.bars?.at?.(-1)?.date||h?.history?.at?.(-1)?.date;if(last>=latestExpectedTradingDate){alreadyCurrent++;continue}}catch{inspectionFailed++}
  candidates.push(item);if(candidates.length>=hb)break;
}
let complete=0,failed=[];
for(const item of candidates){try{const {provider,result}=await registry.fetchDaily(item,{startDate:'1990-01-01',endDate:today},'yahoo-chart');if(!result.bars.length)throw new Error('geen historie');for(const [period,bars] of partitionBars(result.bars))await client.putPartition(item.isin,period,{bars,provider:provider.id});await client.completeHistory(item.isin,{provider:provider.id});complete++;}catch(e){failed.push({isin:item.isin,symbol:item.symbol,mic:item.mic,error:e.message})}}
const report={market:mic,catalog:instruments.length,batchRequested:hb,candidates:candidates.length,alreadyCurrent,excludedProviderUnavailable:excluded,skippedRunFailures,inspectionFailed,complete,failed,remainingHint:Math.max(0,instruments.length-excluded-alreadyCurrent-complete-skippedRunFailures),freshnessCutoff};
console.log(JSON.stringify(report,null,2));
await fs.mkdir('research/output',{recursive:true});await fs.writeFile('research/output/world-fill-batch.json',JSON.stringify({...report,generatedAt:new Date().toISOString()},null,2));
if(failed.length===candidates.length&&candidates.length&&process.env.ALLOW_PARTIAL_FAILURES!=='1')process.exitCode=2;
