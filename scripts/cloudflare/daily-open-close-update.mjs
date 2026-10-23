import {fetchPublicHistoryManifest} from './public-history-manifest.mjs';
import fs from 'node:fs/promises';
import {officialDailyStatus} from '../history/official-daily-status.mjs';
import {FactoryApiClient} from './client.mjs';
import {createDefaultProviderRegistry} from '../history/provider-registry.mjs';
import {storageIdentityResolver,newListingStorageKey} from './storage-identity.mjs';
import {latestClosedWeekday,previousClosedWeekday,isVerifiedNoTradeGap,isCompleteOhlcBar,validBars,mapConcurrent} from './europe-run-policy.mjs';
import {partitionBars} from './history-format.mjs';
import {parisHistoryEligible} from './paris-history-eligibility.mjs';
import {classifyEuropeFailure} from './europe-failure-diagnosis.mjs';
import {verifiedSwissPriorityKey,selectEuropeMissingBackfill} from './europe-missing-backfill-priority.mjs';
const client=new FactoryApiClient(),providers=createDefaultProviderRegistry();
const plan=JSON.parse(await fs.readFile('data/world-fill-plan.json','utf8')),sourceRegistry=JSON.parse(await fs.readFile('data/market-source-registry.json','utf8'));
const today=new Date().toISOString().slice(0,10),results=[];
const shardCount=Number(process.env.EUROPE_SHARD_COUNT||1),shardIndex=Number(process.env.EUROPE_SHARD_INDEX||0);
if(!Number.isInteger(shardCount)||shardCount<1||!Number.isInteger(shardIndex)||shardIndex<0||shardIndex>=shardCount)throw Error('Invalid Europe shard configuration');
const parisRepair=process.env.PARIS_REPAIR_ONLY==='1';
const parisPolicy=JSON.parse(await fs.readFile('config/paris-follow-policy.json','utf8'));
const targetMarkets=plan.markets.filter(x=>x.state==='COMPLETE').filter(x=>!parisRepair||x.mic==='XPAR').filter((_,index)=>index%shardCount===shardIndex);
const reportPath=`research/output/daily-open-close-update-${shardIndex}${process.env.GITHUB_RUN_ATTEMPT?'-attempt-'+process.env.GITHUB_RUN_ATTEMPT:''}.json`;
await fs.mkdir('research/output',{recursive:true});
async function checkpoint(){await fs.writeFile(reportPath,JSON.stringify({generatedAt:new Date().toISOString(),shardIndex,shardCount,mode:process.env.EUROPE_FULL_BACKFILL==='1'?(Number(process.env.GITHUB_RUN_ATTEMPT||1)>1?'REPAIR_REMAINING_LISTINGS':'FULL_APPEND_ONLY_HISTORY_AND_DAILY_TAIL'):'APPEND_ONLY_DAILY_AND_BOUNDED_MISSING',markets:results},null,2));}
// Verify factory credentials once before processing thousands of instruments.
let factoryCatalog;
try { factoryCatalog=await client.catalog(); } catch(error) {
 console.error('FACTORY_AUTH_PREFLIGHT_FAILED: productie-updates vereisen geldige Cloudflare factory-autorisatie: '+error.message);
 process.exit(3);
}
const manifest=await fetchPublicHistoryManifest(client.baseUrl,{shardIndex});
const failureCategory=classifyEuropeFailure;
const freshnessCutoff=latestClosedWeekday();
const fullRequested=process.env.EUROPE_FULL_BACKFILL==='1';
const firstFullAttempt=fullRequested&&Number(process.env.GITHUB_RUN_ATTEMPT||1)===1;
const concurrency=Math.max(1,Math.min(4,Number(process.env.EUROPE_INSTRUMENT_CONCURRENCY||2)));
const missingLimit=Math.max(1,Math.min(80,Number(process.env.EUROPE_MISSING_BACKFILL_LIMIT||35)));
const missingPool=[],priorityMissingPool=[];
const isInactiveParis=(share,marketMic)=>!parisHistoryEligible(share,marketMic,parisPolicy,manifest,resolveExisting);
const resolveExisting=storageIdentityResolver(factoryCatalog.instruments||[]);
for(const market of targetMarkets){
 const catalog=JSON.parse(await fs.readFile(`data/euronext-${market.code}.json`,'utf8'));
 for(const share of (catalog.shares||catalog.instruments||[])){
  if(share.isin&&!isInactiveParis(share,market.mic)&&!manifest[resolveExisting({...share,mic:share.mic||market.mic})]?.lastDate){
   const key=(share.mic||market.mic)+'|'+(share.symbol||share.ticker||share.isin)+'|'+share.isin;
   missingPool.push(key);
   if(verifiedSwissPriorityKey(share,market.mic)===key)priorityMissingPool.push(key);
  }
 }
}
const {selected:selectedMissing,rotation,prioritySelected}=selectEuropeMissingBackfill(missingPool,{limit:missingLimit,dayIndex:Math.floor(Date.now()/86400000),fullRequested,priorityKeys:priorityMissingPool});
console.log('EUROPE_BACKFILL_SELECTION',JSON.stringify({shardIndex,missingPool:missingPool.length,selected:selectedMissing.size,prioritySelected,rotation,firstDate:'1990-01-01',fullBackfill:firstFullAttempt,freshnessCutoff}));

for(const market of targetMarkets){
 const source=sourceRegistry.markets?.[market.mic];if(!source||source.status!=='APPROVED')throw Error(`${market.mic}: COMPLETE zonder APPROVED bronroute`);
 const primary=source.historySources?.find(x=>x.role==='PRIMARY')?.provider;if(!primary)throw Error(`${market.mic}: geen PRIMARY bronroute`);
 if(!providers.get(primary))throw Error(`${market.mic}: onbekende PRIMARY provider ${primary}; bronregister corrigeren`);
 const allowedProviderIds=[primary,...(source.historySources||[]).filter(x=>['DISCOVERY_FALLBACK','FALLBACK'].includes(x.role)&&x.provider!==primary&&providers.get(x.provider)).map(x=>x.provider)];
 const catalog=JSON.parse(await fs.readFile(`data/euronext-${market.code}.json`,'utf8')),allShares=catalog.shares||catalog.instruments||[];
 const shares=allShares.filter(share=>!isInactiveParis(share,market.mic));
 if(shares.length!==allShares.length)console.log('PARIS_INACTIVE_EXCLUDED_FROM_DAILY',JSON.stringify({mic:market.mic,retained:shares.length,inactive:allShares.length-shares.length}));
 // Preserve existing D1 identities, including Reykjavik legacy keys.
 const resolveStored=storageIdentityResolver(factoryCatalog.instruments||[],market.mic);
 const eligibleForSeed=shares.filter(share=>share.isin&&!resolveStored(share));
 for(let i=0;i<eligibleForSeed.length;i+=25){
  const batch=eligibleForSeed.slice(i,i+25).map(share=>({isin:newListingStorageKey(share,market.mic),mic:share.mic||market.mic,ticker:share.symbol||share.ticker,company:share.company||share.name||share.symbol||share.ticker,countryCode:market.country,currency:share.currency||market.currency}));
  await client.seedCatalog({markets:[],instruments:batch,createOnly:true});
 }
 if(eligibleForSeed.length){
  console.log('EUROPE_CATALOG_SEEDED',JSON.stringify({mic:market.mic,count:eligibleForSeed.length}));
  factoryCatalog=await client.catalog();
 }
 const resolveActual=storageIdentityResolver(factoryCatalog.instruments||[],market.mic);
 let advanced=0,current=0,skipped=0,missing=0,deferredMissing=0,stale=0,processed=0,noTrades=[],failed=[],historicalBackfillFailures=[];
 await mapConcurrent(shares,concurrency,async s=>{
  let fullBackfill=firstFullAttempt;
  try{
   const storageIsin=resolveActual(s);
   if(!storageIsin)throw Error('CATALOG_INSTRUMENT_MISSING '+s.isin);
   const beforeDate=manifest[storageIsin]?.lastDate||null;
   // On recovery attempts, preserve and extend stored listings instead of
   // re-fetching decades of already recorded bars. Missing listings still
   // receive the full archive from 1990.
   fullBackfill=firstFullAttempt||(fullRequested&&!beforeDate);
   if(!beforeDate&&!selectedMissing.has((s.mic||market.mic)+'|'+(s.symbol||s.ticker||s.isin)+'|'+s.isin)){deferredMissing++;return;}
   if(!fullBackfill&&beforeDate && beforeDate>=freshnessCutoff){current++;return;}
   const instrument={...s,ticker:s.ticker||s.symbol,symbol:s.symbol||s.ticker,mic:s.mic||market.mic,market:s.mic||market.mic,currency:s.currency||market.currency,countryCode:market.country};
   if(!fullBackfill&&beforeDate){
    const status=await officialDailyStatus(instrument,freshnessCutoff);
    const previous=previousClosedWeekday(freshnessCutoff);
    if(isVerifiedNoTradeGap(status,beforeDate,freshnessCutoff)){noTrades.push({isin:s.isin,symbol:s.symbol||s.ticker,...status});return;}
    if(status?.status==='TRADED'&&isCompleteOhlcBar(status.bar)&&beforeDate===previous){
     await client.putPartition(storageIsin,freshnessCutoff.slice(0,4),{bars:[status.bar],provider:status.provider,appendOnly:true});
     await client.completeHistory(storageIsin,{provider:status.provider});advanced++;return;
    }
   }

   const range={startDate:fullBackfill||!beforeDate?'1990-01-01':new Date(new Date(beforeDate+'T00:00:00Z').getTime()+86400000).toISOString().slice(0,10),endDate:today};
   const {provider,result}=await providers.fetchDaily(instrument,range,primary,{strictPreferred:false,timeoutMs:fullBackfill?60000:20000,allowedProviderIds,acceptResult:r=>{
    const bars=validBars(r,range);
    return bars.length>0&&(fullBackfill||bars.at(-1).date>beforeDate);
   }});
   const bars=validBars(result,range);
   for(const [period,part] of partitionBars(bars))await client.putPartition(storageIsin,period,{bars:part,provider:provider.id,appendOnly:true});
   if(bars.length)await client.completeHistory(storageIsin,{provider:provider.id});
   let afterDate=[beforeDate,bars.at(-1)?.date].filter(Boolean).sort().at(-1);
   // A historical response may stop early. Preserve it, then try all usable
   // providers for the remaining daily tail instead of declaring it current.
   if(fullBackfill&&afterDate&&afterDate<freshnessCutoff){
    const tailRange={startDate:new Date(new Date(afterDate+'T00:00:00Z').getTime()+86400000).toISOString().slice(0,10),endDate:today};
    try{
     const tail=await providers.fetchDaily(instrument,tailRange,primary,{timeoutMs:20000,allowedProviderIds,acceptResult:r=>validBars(r,tailRange).length>0});
     const tailBars=validBars(tail.result,tailRange);
     for(const [period,part] of partitionBars(tailBars))await client.putPartition(storageIsin,period,{bars:part,provider:tail.provider.id,appendOnly:true});
     if(tailBars.length){await client.completeHistory(storageIsin,{provider:tail.provider.id});afterDate=tailBars.at(-1).date;}
    }catch(e){failed.push({isin:s.isin,symbol:s.symbol||s.ticker,category:failureCategory(e.message),error:e.message});}
   }
   if(afterDate&&afterDate<freshnessCutoff){
    const status=await officialDailyStatus(instrument,freshnessCutoff);
    if(status?.status==='TRADED'&&isCompleteOhlcBar(status.bar)){
     await client.putPartition(storageIsin,freshnessCutoff.slice(0,4),{bars:[status.bar],provider:status.provider,appendOnly:true});
     await client.completeHistory(storageIsin,{provider:status.provider});afterDate=freshnessCutoff;
     failed=failed.filter(x=>x.isin!==s.isin);
    }else if(isVerifiedNoTradeGap(status,afterDate,freshnessCutoff)){
     noTrades.push({isin:s.isin,symbol:s.symbol||s.ticker,...status});failed=failed.filter(x=>x.isin!==s.isin);return;
    }
   }
   if(!afterDate)missing++;
   else if(afterDate<freshnessCutoff)stale++;
   else if(!beforeDate||afterDate>beforeDate)advanced++;
   else current++;
  }catch(e){
   if(fullBackfill)historicalBackfillFailures.push({isin:s.isin,symbol:s.symbol||s.ticker,error:e.message});
   let status=null;try{status=await officialDailyStatus({...s,mic:s.mic||market.mic},freshnessCutoff);}catch{}
   const key=resolveActual(s),last=manifest[key]?.lastDate;
   if(isVerifiedNoTradeGap(status,last,freshnessCutoff))noTrades.push({isin:s.isin,symbol:s.symbol||s.ticker,...status});
   else failed.push({isin:s.isin,symbol:s.symbol||s.ticker,category:failureCategory(e.message),error:e.message});
  }
  finally {processed++;if(processed%25===0)console.log('EUROPE_MARKET_PROGRESS',JSON.stringify({mic:market.mic,processed,total:shares.length,advanced,current,stale,missing,failed:failed.length}));}
 });
 results.push({mic:market.mic,catalog:shares.length,advanced,current,stale,missing,deferredMissing,skippedDataUnavailable:skipped,verifiedNoTrades:noTrades.length,noTrades,failed,historicalBackfillFailures});
 await checkpoint();
 const failureCategories=failed.reduce((counts,item)=>(counts[item.category]=(counts[item.category]||0)+1,counts),{});
 console.log('EUROPE_MARKET_DONE',JSON.stringify({mic:market.mic,advanced,current,stale,missing,deferredMissing,skipped,failed:failed.length,failureCategories,examples:failed.slice(0,3)}));
}
await checkpoint();
if(!parisRepair)await import('./reconcile-official-daily.mjs');
console.log(JSON.stringify(results.map(x=>({...x,failed:x.failed.length})),null,2));if(results.some(x=>x.failed.length||x.missing||x.stale||x.deferredMissing))process.exitCode=2;
