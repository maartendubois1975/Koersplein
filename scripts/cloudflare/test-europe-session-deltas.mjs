import assert from 'node:assert/strict';
import {compareEuropeSessionDeltas} from './compare-europe-session-deltas.mjs';
function summary({cutoff='2026-10-23',missing=['GB0000000001','GB0000000002'],noTrade=[],complete=true}={}){
  const markets=Array.from({length:31},(_,i)=>{
    const mic=i===0?'XLON':'X'+String(i).padStart(3,'0');
    const items=i===0?missing:[],trades=i===0?noTrade:[];
    return {mic,catalog:i===0?3:1,openCloseOk:i===0?3-items.length-trades.length:1,
      verifiedNoTrades:trades.length,missingOpenClose:items.length,
      missing:items.map(isin=>({isin,symbol:'TST',reason:'STALE_LAST_TRADE',lastDate:'2026-10-22'})),
      noTrades:trades.map(isin=>({isin,symbol:'TST'}))};
  });
  const importFailures=markets.flatMap(m=>m.missing.map(item=>({
    mic:m.mic,isin:item.isin,symbol:item.symbol,category:'NO_NEW_BARS_IN_RANGE'})));
  return {shardsComplete:complete,
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
const changed=summary();changed.markets[0].missing[0].reason='NO_HISTORY_PARTITIONS';
assert.equal(compareEuropeSessionDeltas(a,changed).reasonChanges.length,1);
assert.equal(compareEuropeSessionDeltas(b,a).added.length,1);
const categoryChanged=summary();
categoryChanged.importFailures[0].category='NETWORK_TIMEOUT';
const categoryDiff=compareEuropeSessionDeltas(a,categoryChanged);
assert.equal(categoryDiff.failureCategoryChanges.length,1);
assert.equal(categoryDiff.failureCategoryChanges[0].before,'NO_NEW_BARS_IN_RANGE');
assert.equal(categoryDiff.failureCategoryChanges[0].after,'NETWORK_TIMEOUT');
const fewerFailures=summary();
fewerFailures.importFailures.shift();
fewerFailures.totals.failedImports=1;
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
console.log('Europe same-cutoff instrument delta PASS: identity, no-trade, import-failure provenance, category changes, fail-closed, immutable');
