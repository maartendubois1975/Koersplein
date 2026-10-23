// Strictly read-only, same-cutoff Europe daily audit comparison.
// A missing->nonmissing transition is NOT proof of a new price write.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
function check(ok,why){if(!ok)throw new Error('UNVERIFIED_EUROPE_RUN: '+why);}
const natural=x=>Number.isSafeInteger(x)&&x>=0;
const id=(mic,isin)=>mic+'\u0000'+isin;
function validate(run,label){
  check(run&&typeof run==='object',label+': missing summary');
  check(run.shardsComplete===true,label+': incomplete shards');
  check(run.marketCoverage?.complete===true,label+': market coverage incomplete');
  for(const k of ['expectedMarkets','reportedUpdateMarkets','reportedAuditMarkets'])
    check(run.marketCoverage[k]===31,label+': '+k+' not 31');
  check(Array.isArray(run.marketCoverage.anomalies)&&run.marketCoverage.anomalies.length===0,label+': market anomalies');
  const cutoff=run.freshnessCutoff;
  check(typeof cutoff==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(cutoff)&&
    !Number.isNaN(Date.parse(cutoff+'T00:00:00Z'))&&
    run.sessionConsistency?.complete===true&&run.sessionConsistency.cutoff===cutoff&&
    Array.isArray(run.sessionConsistency.observedCutoffs)&&
    run.sessionConsistency.observedCutoffs.length===1&&run.sessionConsistency.observedCutoffs[0]===cutoff&&
    Array.isArray(run.sessionConsistency.anomalies)&&run.sessionConsistency.anomalies.length===0,
    label+': unverified cutoff/session');
  check(Array.isArray(run.markets)&&run.markets.length===31,label+': not 31 markets');
  const totals={catalog:0,currentOpenClose:0,verifiedNoTrades:0,missingOpenClose:0};
  const markets=new Map(),missing=new Map(),noTrade=new Map();
  for(const m of run.markets){
    check(typeof m.mic==='string'&&/^[A-Z0-9]{4}$/.test(m.mic)&&!markets.has(m.mic),label+': invalid/duplicate MIC');
    for(const k of ['catalog','openCloseOk','verifiedNoTrades','missingOpenClose'])
      check(natural(m[k]),label+'/'+m.mic+': invalid '+k);
    check(m.catalog===m.openCloseOk+m.verifiedNoTrades+m.missingOpenClose,label+'/'+m.mic+': partition mismatch');
    check(Array.isArray(m.missing)&&m.missing.length===m.missingOpenClose,label+'/'+m.mic+': missing details incomplete');
    check(Array.isArray(m.noTrades)&&m.noTrades.length===m.verifiedNoTrades,label+'/'+m.mic+': no-trade details incomplete');
    markets.set(m.mic,m);
    totals.catalog+=m.catalog;totals.currentOpenClose+=m.openCloseOk;
    totals.verifiedNoTrades+=m.verifiedNoTrades;totals.missingOpenClose+=m.missingOpenClose;
    for(const [items,target,kind] of [[m.missing,missing,'missing'],[m.noTrades,noTrade,'no-trade']]){
      for(const item of items){
        check(typeof item.isin==='string'&&/^[A-Z]{2}[A-Z0-9]{10}$/.test(item.isin),label+'/'+m.mic+': invalid ISIN');
        const k=id(m.mic,item.isin);
        check(!target.has(k),label+'/'+m.mic+': duplicate '+kind+' ISIN');
        target.set(k,{mic:m.mic,isin:item.isin,symbol:item.symbol??null,
          ...(kind==='missing'?{reason:item.reason??null,lastDate:item.lastDate??null}:{})});
      }
    }
  }
  for(const k of missing.keys())check(!noTrade.has(k),label+': missing and no-trade overlap');
  for(const [k,v] of Object.entries(totals))check(run.totals?.[k]===v,label+': inconsistent '+k);
  return {totals,markets,missing,noTrade};
}
export function compareEuropeSessionDeltas(before,after){
  const a=validate(before,'before'),b=validate(after,'after');
  check(before.freshnessCutoff===after.freshnessCutoff,'different trading-session cutoffs');
  check(a.totals.catalog===b.totals.catalog,'catalog changed');
  for(const [mic,m] of a.markets)
    check(b.markets.has(mic)&&b.markets.get(mic).catalog===m.catalog,mic+': catalog/market membership changed');
  const removed=[...a.missing].filter(([k])=>!b.missing.has(k)).map(([k,v])=>({
    ...v,after:b.noTrade.has(k)?'OFFICIAL_NO_TRADE':'NO_LONGER_MISSING_UNVERIFIED_PER_INSTRUMENT'}));
  const added=[...b.missing].filter(([k])=>!a.missing.has(k)).map(([,v])=>v);
  const reasonChanges=[...b.missing].filter(([k,v])=>a.missing.has(k)&&a.missing.get(k).reason!==v.reason)
    .map(([k,v])=>({mic:v.mic,isin:v.isin,before:a.missing.get(k).reason,after:v.reason}));
  const sort=(x,y)=>x.mic.localeCompare(y.mic)||x.isin.localeCompare(y.isin);
  removed.sort(sort);added.sort(sort);reasonChanges.sort(sort);
  check(a.missing.size-removed.length+added.length===b.missing.size,'identity arithmetic mismatch');
  const byMarket=[...a.markets.keys()].sort().map(mic=>{
    const x=a.markets.get(mic),y=b.markets.get(mic);
    return {mic,catalog:x.catalog,currentOhlcDelta:y.openCloseOk-x.openCloseOk,
      noTradeDelta:y.verifiedNoTrades-x.verifiedNoTrades,
      missingDelta:y.missingOpenClose-x.missingOpenClose,
      missingRemoved:removed.filter(v=>v.mic===mic).length,
      missingAdded:added.filter(v=>v.mic===mic).length};
  });
  check(byMarket.every(v=>v.missingDelta===v.missingAdded-v.missingRemoved&&
    v.currentOhlcDelta+v.noTradeDelta+v.missingDelta===0),'market transition arithmetic mismatch');
  return {mode:'READ_ONLY_SAME_CUTOFF_INSTRUMENT_DELTA',status:'COMPLETE_COMPARISON',
    freshnessCutoff:before.freshnessCutoff,
    before:{currentOhlc:a.totals.currentOpenClose,noTrade:a.totals.verifiedNoTrades,missing:a.missing.size},
    after:{currentOhlc:b.totals.currentOpenClose,noTrade:b.totals.verifiedNoTrades,missing:b.missing.size},
    removed,added,reasonChanges,
    byMarket:byMarket.filter(v=>v.currentOhlcDelta||v.noTradeDelta||v.missingDelta),
    productionWrites:0,mappingsApproved:0,
    warning:'NO_LONGER_MISSING is not independent proof of a new appended bar, approved source, or OHLC correctness. Check immutable shard artifacts and stored history before claiming a price repair.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.length!==4){console.error('Usage: node compare-europe-session-deltas.mjs <before-summary.json> <after-summary.json>');process.exitCode=2;}
  else try{
    const [a,b]=await Promise.all(process.argv.slice(2).map(async p=>JSON.parse(await readFile(p,'utf8'))));
    console.log(JSON.stringify(compareEuropeSessionDeltas(a,b),null,2));
  }catch(e){console.error(String(e));process.exitCode=2;}
}
