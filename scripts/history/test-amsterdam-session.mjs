import { strict as assert } from 'node:assert';
import { mergeBars, computeMovers, verifiedBackfillComplete, validateBars } from './engine.mjs';

const preliminary = [{ date: '2026-10-26', open: 100, high: 102, low: 99, close: 101, volume: 1000 }];
const officialClose = [{ date: '2026-10-26', open: 100, high: 105, low: 99, close: 104, volume: 2200 }];
const bars = mergeBars(preliminary, officialClose);
assert.equal(bars.length, 1, 'One trading day must have exactly one record');
assert.equal(bars[0].open, 100);
assert.equal(bars[0].close, 104);
assert.equal(bars[0].volume, 2200);
assert.equal(Number((((bars[0].close / bars[0].open) - 1) * 100).toFixed(2)), 4);
console.log('Amsterdam daily opening/closing merge regression: OK');

const candle=(date,close)=>({date,open:close,high:close,low:close,close,volume:100});
const instrument=(isin)=>({isin,name:isin,symbol:isin,market:'XAMS',mic:'XAMS'});
const fixtures=[
 {instrument:instrument('CURRENT'),provider:'fixture',bars:[candle('2026-10-28',100),candle('2026-10-29',105)]},
 {instrument:instrument('STALE'),provider:'fixture',bars:[candle('2026-10-27',100),candle('2026-10-28',130)]},
 {instrument:instrument('SUSPENDED'),provider:'fixture',bars:[candle('2026-10-20',100),candle('2026-10-29',150)]}
];
assert.deepEqual(computeMovers(fixtures).map(x=>x.isin),['CURRENT'],'Stale or suspended series must not appear in latest daily movers');
assert.deepEqual(computeMovers(fixtures,{targetSession:'2026-10-28'}).map(x=>x.isin),['STALE'],'Explicit target date must select only matching session');
assert.deepEqual(computeMovers(fixtures,{targetSession:'2026-10-30'}),[],'No matching completed session must produce no movers');
console.log('Amsterdam daily movers freshness and suspension regression: OK');

const historicalWithAdjustment=[{date:'2026-10-27',open:100,high:101,low:99,close:100,adjustedClose:92,volume:1000}];
const recentWithUnknownAdjustment=[{date:'2026-10-27',open:100,high:103,low:99,close:102,adjustedClose:null,volume:1200}];
const protectedMerge=mergeBars(historicalWithAdjustment,recentWithUnknownAdjustment.map(bar=>({
 ...bar,adjustedClose:historicalWithAdjustment.find(old=>old.date===bar.date)?.adjustedClose??null
})));
assert.equal(protectedMerge[0].close,102,'Official refreshed closing price must be retained');
assert.equal(protectedMerge[0].adjustedClose,92,'Unknown new adjustment must not erase existing archived adjustment');
console.log('Amsterdam archived adjusted-close preservation regression: OK');

const safeOriginal=[{date:'2026-10-28',open:100,high:104,low:99,close:102,volume:300}];
for(const broken of [
 {date:'2026-10-28',open:100,high:99,low:98,close:105,volume:300},
 {date:'2026-10-28',open:0,high:104,low:99,close:102,volume:300},
 {date:'2026-10-28',open:100,high:104,low:103,close:102,volume:300}
])assert.deepEqual(mergeBars(safeOriginal,[broken]),safeOriginal,'Invalid provider bar must never destroy archived valid session');
assert.equal(mergeBars(safeOriginal,[{date:'2026-10-29',open:102,high:104,low:101,close:103,volume:200}]).length,2);
console.log('Amsterdam invalid provider overwrite protection: OK');

assert.equal(verifiedBackfillComplete({coverage:{backfillComplete:true},provider:{metadata:{}}}),false,'Legacy backfillComplete alone is not verified evidence');
assert.equal(verifiedBackfillComplete({coverage:{backfillComplete:true},provider:{metadata:{completenessEvidenceVerified:true}}}),true);
assert.equal(verifiedBackfillComplete({coverage:{backfillComplete:true},provider:{metadata:{completenessEvidenceVerified:true}}},{partialHistory:true}),false,'Partial provider response invalidates completeness');
assert.equal(verifiedBackfillComplete(null),false);
console.log('Amsterdam historical completeness provenance regression: OK');

assert.equal(validateBars([candle('2026-02-30',100)]).length,0);
assert.equal(validateBars([candle('2026-13-01',100)]).length,0);
assert.equal(validateBars([{...candle('2026-10-29',100),high:-1}]).length,0);
assert.equal(validateBars([{...candle('2026-10-29',100),low:Infinity}]).length,0);
console.log('Strict Amsterdam date and OHLC validation: OK');
