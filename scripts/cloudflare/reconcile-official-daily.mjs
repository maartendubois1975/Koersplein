import fs from 'node:fs/promises';
import { authorizeMarketShard } from '../audit/authorize-market-shard.mjs';
import {FactoryApiClient} from './client.mjs';
import {writeCloudflareHistory} from './history-writer.mjs';
import {storageIdentityResolver} from './storage-identity.mjs';
import {latestClosedWeekday,isCompleteOhlcBar,isTradedOhlcvBar,mapConcurrent} from './europe-run-policy.mjs';
import {officialDailyStatus} from '../history/official-daily-status.mjs';
import {parisHistoryEligible} from './paris-history-eligibility.mjs';
const client=new FactoryApiClient(),catalog=await client.catalog(),manifest=await client.historyManifest();
const plan=JSON.parse(await fs.readFile('data/world-fill-plan.json','utf8'));
const parisPolicy=JSON.parse(await fs.readFile('config/paris-follow-policy.json','utf8'));
const shardCount=Number(process.env.EUROPE_SHARD_COUNT||1),shardIndex=Number(process.env.EUROPE_SHARD_INDEX||0),date=latestClosedWeekday();
const targetMarkets=plan.markets.filter(x=>x.state==='COMPLETE').filter((_,i)=>i%shardCount===shardIndex);
authorizeMarketShard(targetMarkets, { writer: 'cloudflare-daily' });
const resolve=storageIdentityResolver(catalog.instruments||[]),results=[];
for(const market of targetMarkets){
 const c=JSON.parse(await fs.readFile(`data/euronext-${market.code}.json`,'utf8'));
 await mapConcurrent(c.shares||c.instruments||[],2,async s=>{
  const instrument={...s,mic:s.mic||market.mic},key=resolve(instrument);
  if(!key||!parisHistoryEligible(instrument,market.mic,parisPolicy,manifest.instruments||{},resolve)||manifest.instruments?.[key]?.lastDate>=date)return;
  try{
   const status=await officialDailyStatus(instrument,date);
   if(!status)return;
   if(status.status==='TRADED'){
    if(!isCompleteOhlcBar(status.bar)||!isTradedOhlcvBar(status.bar))throw Error('OFFICIAL_PARTIAL_OR_INVALID_OHLC '+instrument.isin);
    await writeCloudflareHistory(client,key,[status.bar],{provider:status.provider,appendOnly:true});
   }
   results.push({market:market.mic,storageKey:key,...status});
  }catch(e){results.push({market:market.mic,storageKey:key,isin:s.isin,error:e.message});}
 });
}
await fs.mkdir('research/output',{recursive:true});
await fs.writeFile(`research/output/daily-official-status-${shardIndex}.json`,JSON.stringify({generatedAt:new Date().toISOString(),shardIndex,date,results},null,2));
console.log('OFFICIAL_DAILY_RECONCILIATION',JSON.stringify({date,tradesImported:results.filter(x=>x.status==='TRADED').length,noTradesVerified:results.filter(x=>x.status==='NO_TRADES').length,errors:results.filter(x=>x.error)}));
