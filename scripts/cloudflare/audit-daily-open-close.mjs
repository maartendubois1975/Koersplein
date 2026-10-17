import fs from 'node:fs/promises';
import {officialDailyStatus} from '../history/official-daily-status.mjs';
import {latestClosedWeekday,mapConcurrent} from './europe-run-policy.mjs';
import {storageIdentityResolver} from './storage-identity.mjs';
import { FactoryApiClient } from './client.mjs';

const client=new FactoryApiClient();
const plan=JSON.parse(await fs.readFile('data/world-fill-plan.json','utf8'));
const shardCount=Number(process.env.EUROPE_SHARD_COUNT||1),shardIndex=Number(process.env.EUROPE_SHARD_INDEX||0);
if(!Number.isInteger(shardCount)||shardCount<1||!Number.isInteger(shardIndex)||shardIndex<0||shardIndex>=shardCount)throw Error('Invalid Europe shard configuration');
const complete=plan.markets.filter(x=>x.state==='COMPLETE').filter((_,index)=>index%shardCount===shardIndex);
const out=[];
const storedCatalog=await client.catalog();
const cutoff=latestClosedWeekday();
for(const market of complete){
  const file=JSON.parse(await fs.readFile(`data/euronext-${market.code}.json`,'utf8'));
  const shares=file.shares||file.instruments||[];
  const resolveStorage=storageIdentityResolver(storedCatalog.instruments||[],market.mic);
  let ok=0,missing=[],skipped=0,noTrades=[];
  await mapConcurrent(shares,3,async s=>{
    try{
      // /coverage contains metadata only; inspect the actual history for the latest bar.
      const storageIsin=resolveStorage(s);
      if(!storageIsin)throw Error('CATALOG_INSTRUMENT_MISSING '+s.isin);
      const partitions=await client.historyPartitions(storageIsin);
      const last=(partitions.partitions||[]).slice().sort((a,b)=>a.period.localeCompare(b.period)).at(-1);
      if(!last)throw Error('NO_HISTORY_PARTITIONS');
      const h=await client.historyPartition(storageIsin,last.period);
      const bars=h?.bars||h?.history||[];
      const b=bars.at?.(-1);
      if(!b||!Number.isFinite(Number(b.open))||Number(b.open)<=0||!Number.isFinite(Number(b.close))||Number(b.close)<=0||!/^\d{4}-\d{2}-\d{2}$/.test(b.date||'')||b.date<cutoff||b.date>new Date().toISOString().slice(0,10)){
        const status=await officialDailyStatus({...s,mic:s.mic||market.mic},cutoff);
        if(b&&/^\d{4}-\d{2}-\d{2}$/.test(b.date||'')&&b.date<=cutoff&&Number.isFinite(Number(b.open))&&Number.isFinite(Number(b.close))&&Number(b.open)>0&&Number(b.close)>0&&status?.status==='NO_TRADES'&&(!status.lastTradeDate||b.date===status.lastTradeDate)){
          noTrades.push({isin:s.isin,symbol:s.symbol||s.ticker,lastStoredDate:b.date,...status});return;
        }
        missing.push({isin:s.isin,symbol:s.symbol||s.ticker,lastDate:b?.date||null,reason:'MISSING_INVALID_OR_STALE_OHLC'});
        return;
      }
      ok++;
    }catch(e){missing.push({isin:s.isin,symbol:s.symbol||s.ticker,error:e.message})}
  });
  out.push({mic:market.mic,name:market.name,catalog:shares.length,openCloseOk:ok,verifiedNoTrades:noTrades.length,noTrades,skippedDataUnavailable:skipped,missingOpenClose:missing.length,missing});
}
await fs.mkdir('research/output',{recursive:true});
await fs.writeFile(`research/output/daily-open-close-audit-${shardIndex}${process.env.GITHUB_RUN_ATTEMPT?'-attempt-'+process.env.GITHUB_RUN_ATTEMPT:''}.json`,JSON.stringify({generatedAt:new Date().toISOString(),shardIndex,shardCount,freshnessCutoff:cutoff,markets:out},null,2));
console.log(JSON.stringify(out.map(x=>({mic:x.mic,catalog:x.catalog,openCloseOk:x.openCloseOk,verifiedNoTrades:x.verifiedNoTrades,skippedDataUnavailable:x.skippedDataUnavailable,missingOpenClose:x.missingOpenClose})),null,2));
if(out.some(x=>x.missingOpenClose)) process.exitCode=2;
