import {fetchPublicHistoryManifest} from './public-history-manifest.mjs';
import fs from 'node:fs/promises';
import {officialDailyStatus} from '../history/official-daily-status.mjs';
import {latestClosedWeekday,isCompleteOhlcBar,isVerifiedNoTradeGap,auditBarIssue,latestAuditBar,mapConcurrent,selectEuropeAuditHistoryPeriods} from './europe-run-policy.mjs';
import {storageIdentityResolver} from './storage-identity.mjs';
import {parisHistoryEligible} from './paris-history-eligibility.mjs';
import {describeOhlcDefects,countOhlcDefects,recentOhlcDebt} from './europe-ohlc-defects.mjs';
import { FactoryApiClient } from './client.mjs';

const client=new FactoryApiClient();
const plan=JSON.parse(await fs.readFile('data/world-fill-plan.json','utf8'));
const shardCount=Number(process.env.EUROPE_SHARD_COUNT||1),shardIndex=Number(process.env.EUROPE_SHARD_INDEX||0);
if(!Number.isInteger(shardCount)||shardCount<1||!Number.isInteger(shardIndex)||shardIndex<0||shardIndex>=shardCount)throw Error('Invalid Europe shard configuration');
const complete=plan.markets.filter(x=>x.state==='COMPLETE').filter((_,index)=>index%shardCount===shardIndex);
const out=[];
const storedCatalog=await client.catalog();
const parisPolicy=JSON.parse(await fs.readFile('config/paris-follow-policy.json','utf8'));
const manifest=await fetchPublicHistoryManifest(client.baseUrl,{shardIndex});
const cutoff=latestClosedWeekday();
for(const market of complete){
  const file=JSON.parse(await fs.readFile(`data/euronext-${market.code}.json`,'utf8'));
  const allShares=file.shares||file.instruments||[];
  const resolveStorage=storageIdentityResolver(storedCatalog.instruments||[],market.mic);
  const shares=allShares.filter(s=>parisHistoryEligible(s,market.mic,parisPolicy,manifest,resolveStorage));
  const inactiveParis=allShares.length-shares.length;
  let ok=0,missing=[],skipped=0,noTrades=[];
  let recentInvalidOhlcDays=0,recentInvalidOhlcInstruments=0;
  const recentOhlcDebtExamples=[];
  // All recent defective stored dates, including instruments whose newest bar is valid.
  // Evidence only: no history writes or inferred price corrections.
  const recentOhlcDebtCandidates=[];
  const knownUnavailable=new Map((market.dataUnavailable||[]).filter(x=>x.status==='DATA_UNAVAILABLE').map(x=>[x.isin,x]));
  const missingReasons={};
  const pushMissing=item=>{missing.push(item);const reason=item.reason||item.error?.split(' ')[0]||'UNCLASSIFIED';missingReasons[reason]=(missingReasons[reason]||0)+1;};
  await mapConcurrent(shares,3,async s=>{
    try{
      // /coverage contains metadata only; inspect the actual history for the latest bar.
      const storageIsin=resolveStorage(s);
      if(!storageIsin)throw Error('CATALOG_INSTRUMENT_MISSING '+s.isin);
      const partitions=await client.historyPartitions(storageIsin);
      // The 30-day window crosses two yearly partitions around New Year.
      // Reading only the latest year undercounts historical defects and can
      // mistake a valid prior-year latest trade for missing stored history.
      const periods=selectEuropeAuditHistoryPeriods(partitions.partitions||[],cutoff,30);
      if(!periods.length)throw Error('NO_HISTORY_PARTITIONS');
      const histories=await Promise.all(periods.map(period=>client.historyPartition(storageIsin,period)));
      const bars=histories.flatMap(h=>h?.bars||h?.history||[]);
      const debt=recentOhlcDebt(bars,cutoff,30);
      if(debt.invalidDates.length){
        recentInvalidOhlcInstruments++;
        recentInvalidOhlcDays+=debt.invalidDates.length;
        for(const defect of debt.invalidDates){
          // Read-only exact stored snapshot: quantify whether invalid OHLC is
          // rounding noise or a material mismatch before any correction design.
          const stored=bars.find(row=>row?.date===defect.date&&describeOhlcDefects(row).length>0);
          const storedOhlc=stored?{open:stored.open??null,high:stored.high??null,low:stored.low??null,close:stored.close??null}:null;
          recentOhlcDebtCandidates.push({isin:s.isin,symbol:s.symbol||s.ticker,date:defect.date,defects:defect.defects,storedOhlc});
        }
        if(recentOhlcDebtExamples.length<12)recentOhlcDebtExamples.push({isin:s.isin,symbol:s.symbol||s.ticker,invalidDates:debt.invalidDates.slice(-5)});
      }
      // Partition responses are not guaranteed sorted. Audit the maximum dated bar,
      // rather than assuming the last array element is the latest trade.
      const latestAny=latestAuditBar(bars);
      // A still-open session cannot replace the last completed daily candle;
      // a complete duplicate on the same date outranks an incomplete row.
      const b=latestAuditBar(bars,cutoff);
      const barIssue=auditBarIssue(b||latestAny,cutoff,new Date().toISOString().slice(0,10));
      if(barIssue){
        const status=await officialDailyStatus({...s,mic:s.mic||market.mic},cutoff);
        if(isCompleteOhlcBar(b)&&b.date<cutoff&&isVerifiedNoTradeGap(status,b.date,cutoff)){
          noTrades.push({isin:s.isin,symbol:s.symbol||s.ticker,lastStoredDate:b.date,...status});return;
        }
        pushMissing({isin:s.isin,symbol:s.symbol||s.ticker,lastDate:b?.date||latestAny?.date||null,reason:barIssue,ohlcDefects:barIssue==='INCOMPLETE_OR_INVALID_OHLC'?describeOhlcDefects(b||latestAny):[],storedOhlc:barIssue==='INCOMPLETE_OR_INVALID_OHLC'&& (b||latestAny)?{open:(b||latestAny).open??null,high:(b||latestAny).high??null,low:(b||latestAny).low??null,close:(b||latestAny).close??null}:null,officialNoTradeReported:status?.status==='NO_TRADES',officialLastTradeDate:status?.lastTradeDate||null,knownDataUnavailable:knownUnavailable.get(s.isin)?.reason||null});
        return;
      }
      ok++;
    }catch(e){pushMissing({isin:s.isin,symbol:s.symbol||s.ticker,error:e.message,reason:/NO_HISTORY_PARTITIONS/.test(e.message)?'NO_HISTORY_PARTITIONS':/CATALOG_INSTRUMENT_MISSING/.test(e.message)?'CATALOG_INSTRUMENT_MISSING':'AUDIT_FETCH_ERROR',knownDataUnavailable:knownUnavailable.get(s.isin)?.reason||null})}
  });
  recentOhlcDebtCandidates.sort((a,b)=>a.isin.localeCompare(b.isin)||a.date.localeCompare(b.date));
  out.push({mic:market.mic,name:market.name,catalog:shares.length,inactiveParis,openCloseOk:ok,verifiedNoTrades:noTrades.length,noTrades,skippedDataUnavailable:skipped,missingOpenClose:missing.length,missingReasons,invalidOhlcByDefect:countOhlcDefects(missing),recentInvalidOhlcDays,recentInvalidOhlcInstruments,recentOhlcDebtExamples,recentOhlcDebtCandidates,knownDataUnavailableAmongMissing:missing.filter(x=>x.knownDataUnavailable).length,missing});
}
await fs.mkdir('research/output',{recursive:true});
await fs.writeFile(`research/output/daily-open-close-audit-${shardIndex}${process.env.GITHUB_RUN_ATTEMPT?'-attempt-'+process.env.GITHUB_RUN_ATTEMPT:''}.json`,JSON.stringify({generatedAt:new Date().toISOString(),shardIndex,shardCount,freshnessCutoff:cutoff,markets:out},null,2));
console.log(JSON.stringify(out.map(x=>({mic:x.mic,catalog:x.catalog,openCloseOk:x.openCloseOk,verifiedNoTrades:x.verifiedNoTrades,skippedDataUnavailable:x.skippedDataUnavailable,missingOpenClose:x.missingOpenClose})),null,2));
if(out.some(x=>x.missingOpenClose)) process.exitCode=2;
