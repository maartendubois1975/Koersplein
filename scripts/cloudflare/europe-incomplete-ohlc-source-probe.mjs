// Post-audit, read-only source check for existing incomplete OHLC candles.
// Never attempts an overwrite: the production Worker deliberately preserves
// previously stored dates when appendOnly=true.
import fs from 'node:fs/promises';
import {createDefaultProviderRegistry} from '../history/provider-registry.mjs';
import {mapConcurrent} from './europe-run-policy.mjs';
import {selectIncompleteOhlcCandidates,probeIncompleteOhlcCandidate} from './europe-ohlc-source-evidence.mjs';
const path='research/output/europe-recovery-queue.json';
const output='research/output/europe-incomplete-ohlc-source-probe.json';
await fs.mkdir('research/output',{recursive:true});
let queue;
try{queue=JSON.parse(await fs.readFile(path,'utf8'));}
catch(error){
 const report={generatedAt:new Date().toISOString(),mode:'READ_ONLY',status:'QUEUE_UNAVAILABLE',error:error.code||error.message,results:[]};
 await fs.writeFile(output,JSON.stringify(report,null,2));
 console.log('EUROPE_OHLC_SOURCE_PROBE',JSON.stringify({status:report.status}));
 process.exit(0);
}
const rotation=Number(process.env.GITHUB_RUN_NUMBER||Math.floor(Date.now()/86400000));
const items=selectIncompleteOhlcCandidates(queue,{limit:30,perMarket:18,rotation});
const plan=JSON.parse(await fs.readFile('data/world-fill-plan.json','utf8'));
const sourceRegistry=JSON.parse(await fs.readFile('data/market-source-registry.json','utf8'));
const markets=new Map(plan.markets.filter(x=>x.state==='COMPLETE').map(x=>[x.mic,x]));
const registry=createDefaultProviderRegistry(),catalogs=new Map(),results=new Array(items.length);
await mapConcurrent(items,2,async(item,index)=>{
 const market=markets.get(item.mic);
 let listings=[];
 if(market){
  try{
   if(!catalogs.has(item.mic))catalogs.set(item.mic,fs.readFile(`data/euronext-${market.code}.json`,'utf8').then(JSON.parse));
   const catalog=await catalogs.get(item.mic);
   listings=catalog.shares||catalog.instruments||[];
  }catch(error){
   results[index]={mic:item.mic,isin:item.isin,date:item.lastStoredDate,evidenceScope:item.evidenceScope||'LATEST_AUDIT_BAR',status:'CATALOG_READ_ERROR',error:String(error.message).slice(0,250),readOnly:true};
   return;
  }
 }
 results[index]=await probeIncompleteOhlcCandidate(item,{registry,sources:sourceRegistry.markets?.[item.mic],market,listings});
});
const counts={},scopeCounts={},marketCounts={};
for(const row of results){
 counts[row.status]=(counts[row.status]||0)+1;
 scopeCounts[row.evidenceScope||'LATEST_AUDIT_BAR']=(scopeCounts[row.evidenceScope||'LATEST_AUDIT_BAR']||0)+1;
 marketCounts[row.mic]=(marketCounts[row.mic]||0)+1;
}
const report={generatedAt:new Date().toISOString(),mode:'READ_ONLY_NO_PRODUCTION_WRITES',status:'COMPLETED',sourceQueueGeneratedAt:queue.generatedAt||null,rotation,requested:items.length,counts,scopeCounts,marketCounts,results};
await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log('EUROPE_OHLC_SOURCE_PROBE',JSON.stringify({requested:items.length,counts}));
