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
  return {shardsComplete:complete,
    marketCoverage:{complete,expectedMarkets:31,reportedUpdateMarkets:31,reportedAuditMarkets:31,anomalies:[]},
    sessionConsistency:{complete,cutoff,observedCutoffs:[cutoff],anomalies:[]},freshnessCutoff:cutoff,markets,
    totals:{catalog:33,currentOpenClose:markets.reduce((n,m)=>n+m.openCloseOk,0),
      verifiedNoTrades:noTrade.length,missingOpenClose:missing.length}};
}
const a=summary(),b=summary({missing:['GB0000000002']});
const original=JSON.stringify([a,b]),diff=compareEuropeSessionDeltas(a,b);
assert.equal(diff.status,'COMPLETE_COMPARISON');
assert.equal(diff.removed.length,1);
assert.equal(diff.removed[0].isin,'GB0000000001');
assert.equal(diff.removed[0].after,'NO_LONGER_MISSING_UNVERIFIED_PER_INSTRUMENT');
assert.equal(diff.added.length,0);
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
const reject=[
  [summary({cutoff:'2026-10-22'}),b,'different trading-session'],
  [summary({complete:false}),b,'incomplete shards'],
  [a,{...b,sessionConsistency:undefined},'unverified cutoff'],
  [a,{...b,marketCoverage:{...b.marketCoverage,reportedAuditMarkets:7}},'not 31'],
  [a,{...b,totals:{...b.totals,missingOpenClose:0}},'inconsistent missingOpenClose'],
  [a,{...b,markets:b.markets.slice(1)},'not 31 markets'],
  [a,{...b,markets:b.markets.map((m,i)=>i===0?{...m,missing:[...m.missing,m.missing[0]]}:m)},'missing details incomplete']
];
for(const [x,y,msg] of reject)assert.throws(()=>compareEuropeSessionDeltas(x,y),new RegExp(msg));
const drift=summary();
drift.markets[0].missing[0].symbol='OTHER';
assert.throws(()=>compareEuropeSessionDeltas(a,drift),/ticker changed/);
const invalid=summary({cutoff:'2026-02-31'});
assert.throws(()=>compareEuropeSessionDeltas(invalid,b),/unverified cutoff/);
console.log('Europe same-cutoff instrument delta PASS: identity, no-trade, reasons, fail-closed, immutable');
