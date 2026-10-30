import { strict as assert } from 'node:assert';
import { mergeBars, computeMovers } from './engine.mjs';

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
