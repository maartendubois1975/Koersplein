import fs from 'node:fs/promises';
import {officialDailyStatus} from '../history/official-daily-status.mjs';
import {latestClosedWeekday,isCompleteOhlcBar,isVerifiedNoTradeGap,auditBarIssue,mapConcurrent} from './europe-run-policy.mjs';
import {storageIdentityResolver} from './storage-identity.mjs';
import {parisHistoryEligible} from './paris-history-eligibility.mjs';
import { FactoryApiClient } from './client.mjs';

const client=new FactoryApiClient();
const plan=JSON.parse(await fs.readFile('data/world-fill-plan.json','utf8'));
const shardCount=Number(process.env.EUROPE_SHARD_COUNT||1),shardIndex=Number(process.env.EUROPE_SHARD_INDEX||0);
if(!Number.isInteger(shardCount)||shardCount<1||!Number.isInteger(shardIndex)||shardIndex<0||shardIndex>=shardCount)throw Error('Invalid Europe shard configuration');
const complete=plan.markets.filter(x=>x.state==='COMPLETE').filter((_,index)=>index%shardCount===shardIndex);
const out=[];
const storedCatalog=await client.catalog();
const parisPolicy=JSON.parse(await fs.readFile('config/paris-follow-policy.json','utf8'));
const manifestResponse=await fetch(client.baseUrl+'/api/history/manifest.json',{signal:AbortSignal.timeout(30000)});
if(!manifestResponse.ok)throw Error('Public manifest HTTP '+manifestResponse.status);
const manifest=(await manifestResponse.json()).instruments||{};
const cutoff=latestClosedWeekday();
for(const market of complete){
  const file=JSON.parse(await fs.readFile(`data/euronext-${market.code}.json`,'utf8'));
  const allShares=file.shares||file.instruments||[];
  const resolveStorage=storageIdentityResolver(storedCatalog.instruments||[],market.mic);
  const shares=allShares.filter(s=>parisHistoryEligible(s,market.mic,parisPolicy,manifest,resolveStorage));
  const inactiveParis=allShares.length-shares.length;
  let ok=0,missing=[],skipped=0,noTrades=[];
  const knownUnavailable=new Map((market.dataUnavailable||[]).filter(x=>x.status==='DATA_UNAVAILABLE').map(x=>[x.isin,x]));
  const missingReasons={};
  const pushMissing=item=>{missing.push(item);const reason=item.reason||item.error?.split(' ')[0]||'UNCLASSIFIED';missingReasons[reason]=(missingReasons[reason]||0)+1;};
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
      // Partition responses are not guaranteed sorted. Audit the maximum dated bar,
      // rather than assuming the last array element is the latest trade.
      const b=bars.filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x?.date||'')).reduce((latest,x)=>!latest||x.date>latest.date?x:latest,null);
      const barIssue=auditBarIssue(b,cutoff,new Date().toISOString().slice(0,10));
      if(barIssue){
        const status=await officialDailyStatus({...s,mic:s.mic||market.mic},cutoff);
        if(isCompleteOhlcBar(b)&&b.date<cutoff&&isVerifiedNoTradeGap(status,b.date,cutoff)){
          noTrades.push({isin:s.isin,symbol:s.symbol||s.ticker,lastStoredDate:b.date,...status});return;
        }
        pushMissing({isin:s.isin,symbol:s.symbol||s.ticker,lastDate:b?.date||null,reason:barIssue,officialNoTradeReported:status?.status==='NO_TRADES',officialLastTradeDate:status?.lastTradeDate||null,knownDataUnavailable:knownUnavailable.get(s.isin)?.reason||null});
        return;
      }
      ok++;
    }catch(e){pushMissing({isin:s.isin,symbol:s.symbol||s.ticker,error:e.message,reason:/NO_HISTORY_PARTITIONS/.test(e.message)?'NO_HISTORY_PARTITIONS':/CATALOG_INSTRUMENT_MISSING/.test(e.message)?'CATALOG_INSTRUMENT_MISSING':'AUDIT_FETCH_ERROR',knownDataUnavailable:knownUnavailable.get(s.isin)?.reason||null})}
  });
  out.push({mic:market.mic,name:market.name,catalog:shares.length,inactiveParis,openCloseOk:ok,verifiedNoTrades:noTrades.length,noTrades,skippedDataUnavailable:skipped,missingOpenClose:missing.length,missingReasons,knownDataUnavailableAmongMissing:missing.filter(x=>x.knownDataUnavailable).length,missing});
}
await fs.mkdir('research/output',{recursive:true});
await fs.writeFile(`research/output/daily-open-close-audit-${shardIndex}${process.env.GITHUB_RUN_ATTEMPT?'-attempt-'+process.env.GITHUB_RUN_ATTEMPT:''}.json`,JSON.stringify({generatedAt:new Date().toISOString(),shardIndex,shardCount,freshnessCutoff:cutoff,markets:out},null,2));
console.log(JSON.stringify(out.map(x=>({mic:x.mic,catalog:x.catalog,openCloseOk:x.openCloseOk,verifiedNoTrades:x.verifiedNoTrades,skippedDataUnavailable:x.skippedDataUnavailable,missingOpenClose:x.missingOpenClose})),null,2));
if(out.some(x=>x.missingOpenClose)) process.exitCode=2;
