import assert from 'node:assert/strict';
import {assessPeriod} from './amsterdam-period-quality.mjs';
import {validateHistoryDocument,filterPeriod,periodStartDate} from '../../chart.js';
const candle=(date,close)=>({date,open:close,high:close,low:close,close});
const clean=assessPeriod([candle('2026-10-28',100),candle('2026-10-29',101)]);
assert.equal(clean.issues.length,0);
assert.equal(clean.cleanObservationDates.length,2);
assert.match(clean.researchReturnStatus,/BLOCKED/);
const suspicious=assessPeriod([candle('2026-01-01',100),candle('2026-02-15',250)]);
assert.deepEqual(suspicious.issues.map(x=>x.kind),['LONG_GAP','UNVERIFIED_PRICE_JUMP']);
assert.deepEqual(suspicious.cleanObservationDates,['2026-01-01']);
const incomplete=assessPeriod([{date:'2026-10-29',open:1,close:1}]);
assert.equal(incomplete.issues[0].kind,'MISSING_HIGH_LOW');
const duplicate=assessPeriod([candle('2026-10-29',1),candle('2026-10-29',1)]);
assert.equal(duplicate.issues[0].kind,'DUPLICATE_DATE');
const invalid=assessPeriod([candle('2026-02-30',1),candle('2026-03-01',1)]);
assert.equal(invalid.issues[0].kind,'INVALID_DATE');
// Browser-normalized bars must preserve missing source fields, never invent zero prices.
const identity={isin:'NL0000000001',symbol:'TEST',mic:'XAMS'};
const doc={schemaVersion:1,instrument:identity,coverage:{records:2,firstDate:'2026-10-28',lastDate:'2026-10-29'},bars:[
 {date:'2026-10-28',open:100,close:100,high:null,low:null,adjustedClose:null},
 {date:'2026-10-29',open:101,close:101,high:102,low:100}
]};
const browserBars=validateHistoryDocument(doc,identity);
assert.equal(browserBars[0].high,null);
assert.equal(browserBars[0].low,null);
assert.equal(browserBars[0].adjustedClose,null);
assert.equal(browserBars[0].volume,null);
const browserQuality=assessPeriod(browserBars);
assert.deepEqual(browserQuality.issues.map(x=>x.kind),['MISSING_HIGH_LOW']);
assert.equal(filterPeriod(browserBars,'1M').length,2);
assert.equal(periodStartDate('2026-10-31','1M'),'2026-09-30','Month-end must clamp to September 30');
assert.equal(periodStartDate('2024-03-31','1M'),'2024-02-29','Leap February must be preserved');
assert.equal(periodStartDate('2026-10-31','3M'),'2026-07-31');
assert.equal(periodStartDate('2026-10-31','MAX'),null);
const discontinuity=assessPeriod([candle('2026-10-01',100),candle('2026-10-30',201)]);
assert.ok(discontinuity.issues.some(x=>x.kind==='UNVERIFIED_PRICE_JUMP'&&x.date==='2026-10-30'));
console.log('Amsterdam period quality, month-end charts and browser normalization fixtures passed');
