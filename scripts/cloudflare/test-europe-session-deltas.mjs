import assert from 'node:assert/strict';
import {compareEuropeSessionDeltas} from './compare-europe-session-deltas.mjs';
function summary({cutoff='2026-10-23',missing=['GB0000000001','GB0000000002'],noTrade=[],complete=true}={}){
  const markets=Array.from({length:31},(_,i)=>{
    const mic=i===0?'XBRU':'X'+String(i).padStart(3,'0');
    const items=i===0?missing:[],trades=i===0?noTrade:[];
    return {mic,catalog:i===0?3:1,openCloseOk:i===0?3-items.length-trades.length:1,
      verifiedNoTrades:trades.length,missingOpenClose:items.length,
      missing:items.map(isin=>({isin,symbol:'TST',reason:'STALE_LAST_TRADE',lastDate:'2026-10-22'})),
      noTrades:trades.map(isin=>({isin,symbol:'TST',mic,date:cutoff,status:'NO_TRADES',provider:'euronext-live',sourceUrl:'https://live.euronext.com/en/ajax/getHistoricalPricePopup/'+isin+'-XBRU',trades:0,volume:0}))};
  });
  const importFailures=markets.flatMap(m=>m.missing.map(item=>({
    mic:m.mic,isin:item.isin,symbol:item.symbol,category:'NO_NEW_BARS_IN_RANGE'})));
  const sourceFailureByMarket=Object.fromEntries(markets.map(m=>[m.mic,{
    failed:m.missing.length,
    categories:m.missing.length?{NO_NEW_BARS_IN_RANGE:m.missing.length}:{}
  }]));
  return {shardsComplete:complete,
    sourceFailureByMarket,
    importFailures,
    marketCoverage:{complete,expectedMarkets:31,reportedUpdateMarkets:31,reportedAuditMarkets:31,anomalies:[]},
    sessionConsistency:{complete,cutoff,observedCutoffs:[cutoff],anomalies:[]},freshnessCutoff:cutoff,markets,
    totals:{catalog:33,currentOpenClose:markets.reduce((n,m)=>n+m.openCloseOk,0),
      verifiedNoTrades:noTrade.length,missingOpenClose:missing.length,
      failedImports:importFailures.length}};
}
const a=summary(),b=summary({missing:['GB0000000002']});
const original=JSON.stringify([a,b]),diff=compareEuropeSessionDeltas(a,b);
assert.equal(diff.status,'COMPLETE_COMPARISON');
assert.equal(diff.removed.length,1);
assert.equal(diff.removed[0].isin,'GB0000000001');
assert.equal(diff.removed[0].after,'NO_LONGER_MISSING_UNVERIFIED_PER_INSTRUMENT');
assert.equal(diff.added.length,0);
assert.equal(diff.before.failedImports,2);
assert.equal(diff.after.failedImports,1);
assert.equal(diff.failureRemoved.length,1);
assert.equal(diff.failureRemoved[0].isin,'GB0000000001');
assert.equal(diff.failureAdded.length,0);
assert.equal(diff.byMarket[0].failedImportsDelta,-1);
assert.equal(diff.byMarket.length,1);
assert.equal(diff.byMarket[0].currentOhlcDelta,1);
assert.equal(JSON.stringify([a,b]),original,'read-only analyzer must not mutate inputs');
const noTrade=compareEuropeSessionDeltas(a,summary({missing:['GB0000000002'],noTrade:['GB0000000001']}));
assert.equal(noTrade.removed[0].after,'OFFICIAL_NO_TRADE');
assert.equal(noTrade.byMarket[0].currentOhlcDelta,0);
assert.equal(noTrade.byMarket[0].noTradeDelta,1);
assert.equal(noTrade.noTradeAdded.length,1,'official no-trade additions must identify the exact instrument');
assert.equal(noTrade.noTradeAdded[0].isin,'GB0000000001');
assert.equal(noTrade.noTradeAdded[0].before,'MISSING');
assert.equal(noTrade.noTradeRemoved.length,0);
assert.equal(noTrade.byMarket[0].officialNoTradeAdded,1);
assert.equal(noTrade.byMarket[0].officialNoTradeRemoved,0);
// An apparent official NO_TRADES transition is not trusted merely because
// it appears in a complete 31-MIC summary. Require matching approved-source
// provenance and a zero-trade session (or the bounded MSE last-trade proof).
for(const [field,value,error] of [
  ['status','TRADED',/no-trade identity\/session provenance incomplete/],
  ['date','2026-10-22',/no-trade identity\/session provenance incomplete/],
  ['mic','XPAR',/no-trade identity\/session provenance incomplete/],
  ['provider','unknown-feed',/no-trade provider not approved/],
  ['sourceUrl','https://example.com/not-official',/no-trade source URL not official/],
  ['trades',1,/no-trade zero-volume\/trades evidence incomplete/],
  ['volume',null,/no-trade zero-volume\/trades evidence incomplete/]
]){
  const bad=summary({missing:['GB0000000002'],noTrade:['GB0000000001']});
  bad.markets[0].noTrades[0][field]=value;
  assert.throws(()=>compareEuropeSessionDeltas(a,bad),error);
}
const mse=summary({missing:['GB0000000002'],noTrade:['GB0000000001']});
mse.markets[0].mic='XMAL';
mse.sourceFailureByMarket.XMAL=mse.sourceFailureByMarket.XBRU;
delete mse.sourceFailureByMarket.XBRU;
mse.importFailures[0].mic='XMAL';
mse.markets[0].noTrades[0]={
  isin:'GB0000000001',symbol:'TST',mic:'XMAL',date:'2026-10-23',status:'NO_TRADES',
  provider:'mse-official-price-list',
  sourceUrl:'https://cdn.borzamalta.com.mt/download/statistics/Price_List/Price%20List.pdf',
  lastTradeDate:'2026-10-22',verification:'OFFICIAL_LAST_TRADE_BEFORE_PRICE_LIST_SESSION',readOnly:true
};
assert.equal(compareEuropeSessionDeltas(mse,mse).status,'COMPLETE_COMPARISON');
const badMse=structuredClone(mse);
badMse.markets[0].noTrades[0].lastTradeDate='2026-10-23';
assert.throws(()=>compareEuropeSessionDeltas(mse,badMse),/Malta no-trade last-trade evidence incomplete/);
const previouslyNoTrade=summary({missing:['GB0000000002'],noTrade:['GB0000000001']});
const tradeStatusLost=compareEuropeSessionDeltas(previouslyNoTrade,b);
assert.equal(tradeStatusLost.noTradeRemoved.length,1);
assert.equal(tradeStatusLost.noTradeRemoved[0].isin,'GB0000000001');
assert.equal(tradeStatusLost.noTradeRemoved[0].after,'NO_LONGER_OFFICIAL_NO_TRADE_UNVERIFIED');
assert.equal(tradeStatusLost.noTradeAdded.length,0);
assert.equal(tradeStatusLost.byMarket[0].officialNoTradeRemoved,1);
assert.equal(tradeStatusLost.byMarket[0].currentOhlcDelta,1);
const tradeStatusToMissing=compareEuropeSessionDeltas(previouslyNoTrade,a);
assert.equal(tradeStatusToMissing.noTradeRemoved[0].after,'MISSING');
assert.equal(tradeStatusToMissing.added[0].isin,'GB0000000001');
assert.equal(tradeStatusToMissing.byMarket[0].noTradeDelta,-1);
assert.equal(tradeStatusToMissing.byMarket[0].missingDelta,1);
const changed=summary();changed.markets[0].missing[0].reason='NO_HISTORY_PARTITIONS';
assert.equal(compareEuropeSessionDeltas(a,changed).reasonChanges.length,1);
const reasonOnly=compareEuropeSessionDeltas(a,changed);
assert.equal(reasonOnly.byMarket.length,1,'reason-only changes must appear in per-MIC rollup');
assert.equal(reasonOnly.byMarket[0].missingReasonChanges,1);
assert.equal(reasonOnly.byMarket[0].missingDelta,0);
assert.equal(compareEuropeSessionDeltas(b,a).added.length,1);
const categoryChanged=summary();
categoryChanged.importFailures[0].category='NETWORK_TIMEOUT';
categoryChanged.sourceFailureByMarket.XBRU.categories={NO_NEW_BARS_IN_RANGE:1,NETWORK_TIMEOUT:1};
const categoryDiff=compareEuropeSessionDeltas(a,categoryChanged);
assert.equal(categoryDiff.failureCategoryChanges.length,1);
assert.equal(categoryDiff.failureCategoryChanges[0].before,'NO_NEW_BARS_IN_RANGE');
assert.equal(categoryDiff.failureCategoryChanges[0].after,'NETWORK_TIMEOUT');
assert.equal(categoryDiff.byMarket.length,1,'category-only changes must appear in per-MIC rollup');
assert.equal(categoryDiff.byMarket[0].mic,'XBRU');
assert.equal(categoryDiff.byMarket[0].failureCategoryChanges,1);
assert.equal(categoryDiff.byMarket[0].failedImportsDelta,0);
const fewerFailures=summary();
fewerFailures.importFailures.shift();
fewerFailures.totals.failedImports=1;
fewerFailures.sourceFailureByMarket.XBRU.failed=1;
fewerFailures.sourceFailureByMarket.XBRU.categories.NO_NEW_BARS_IN_RANGE=1;
const failureOnlyDiff=compareEuropeSessionDeltas(a,fewerFailures);
assert.equal(failureOnlyDiff.removed.length,0);
assert.equal(failureOnlyDiff.failureRemoved.length,1);
assert.equal(failureOnlyDiff.byMarket[0].failedImportsDelta,-1);
const reject=[
  [summary({cutoff:'2026-10-22'}),b,'different trading-session'],
  [summary({complete:false}),b,'incomplete shards'],
  [a,{...b,sessionConsistency:undefined},'unverified cutoff'],
  [a,{...b,marketCoverage:{...b.marketCoverage,reportedAuditMarkets:7}},'not 31'],
  [a,{...b,totals:{...b.totals,missingOpenClose:0}},'inconsistent missingOpenClose'],
  [a,{...b,markets:b.markets.slice(1)},'not 31 markets'],
  [a,{...b,markets:b.markets.map((m,i)=>i===0?{...m,missing:[...m.missing,m.missing[0]]}:m)},'missing details incomplete'],
  [a,{...b,importFailures:undefined},'import failure details incomplete'],
  [a,{...b,sourceFailureByMarket:undefined},'source failure MIC coverage incomplete'],
  [a,{...b,sourceFailureByMarket:{...b.sourceFailureByMarket,XLON:{
    ...b.sourceFailureByMarket.XBRU,failed:0}}},'source failure count mismatch'],
  [a,{...b,sourceFailureByMarket:{...b.sourceFailureByMarket,XLON:{
    ...b.sourceFailureByMarket.XBRU,categories:{NETWORK_TIMEOUT:1}}}},'source failure category count mismatch'],
  [a,{...b,totals:{...b.totals,failedImports:0}},'import failure details incomplete'],
  [a,{...b,importFailures:[...b.importFailures,b.importFailures[0]],
    totals:{...b.totals,failedImports:2}},'duplicate import failure'],
  [a,{...b,importFailures:[{...b.importFailures[0],isin:'GB0000000003'}]},'import failure not in missing inventory'],
  [a,{...b,importFailures:[{...b.importFailures[0],symbol:'OTHER'}]},'import failure ticker drift'],
  [a,{...b,importFailures:[{...b.importFailures[0],category:'invalid category'}]},'invalid import failure category']
];
for(const [x,y,msg] of reject)assert.throws(()=>compareEuropeSessionDeltas(x,y),new RegExp(msg));
const drift=summary();
drift.markets[0].missing[0].symbol='OTHER';
drift.importFailures[0].symbol='OTHER';
assert.throws(()=>compareEuropeSessionDeltas(a,drift),/ticker changed/);
const invalid=summary({cutoff:'2026-02-31'});
assert.throws(()=>compareEuropeSessionDeltas(invalid,b),/unverified cutoff/);
// Production includes eight XICE:SYMBOL placeholders: compare exact catalog keys
// but never mislabel them as verified ISIN identities.
const iceBefore=summary(),iceAfter=summary({missing:['GB0000000002']});
iceBefore.markets[0].mic='XICE';iceAfter.markets[0].mic='XICE';
iceBefore.sourceFailureByMarket.XICE=iceBefore.sourceFailureByMarket.XBRU;
iceAfter.sourceFailureByMarket.XICE=iceAfter.sourceFailureByMarket.XBRU;
delete iceBefore.sourceFailureByMarket.XBRU;
delete iceAfter.sourceFailureByMarket.XBRU;
iceBefore.markets[0].missing[0].isin='XICE:BRIM';
iceBefore.importFailures[0].mic='XICE';
iceBefore.importFailures[0].isin='XICE:BRIM';
iceBefore.importFailures[1].mic='XICE';
iceAfter.importFailures[0].mic='XICE';
const iceDelta=compareEuropeSessionDeltas(iceBefore,iceAfter);
assert.equal(iceDelta.removed[0].identifierType,'NON_ISIN_CATALOG_KEY');
assert.equal(iceDelta.nonIsinCatalogKeys.before,1);
assert.equal(iceDelta.nonIsinCatalogKeys.after,0);
const bogus=summary();bogus.markets[0].missing[0].isin='XICE:BRIM';
assert.throws(()=>compareEuropeSessionDeltas(bogus,b),/unrecognized catalog identifier/);
// XICE placeholders are not permission to invent London or Swiss ISINs.
const fakeLondon=summary();
fakeLondon.markets[0].missing[0].isin='XLON:UNVERIFIED';
fakeLondon.importFailures[0].isin='XLON:UNVERIFIED';
assert.throws(()=>compareEuropeSessionDeltas(fakeLondon,b),/unrecognized catalog identifier/);
const fakeSwiss=summary();
fakeSwiss.markets[0].mic='XSWX';
fakeSwiss.markets[0].missing[0].isin='XSWX:123456';
fakeSwiss.importFailures[0].mic='XSWX';
fakeSwiss.importFailures[0].isin='XSWX:123456';
assert.throws(()=>compareEuropeSessionDeltas(fakeSwiss,b),/unrecognized catalog identifier/);
console.log('Europe same-cutoff instrument delta PASS: identity, no-trade, import-failure provenance, category changes, fail-closed, immutable');
