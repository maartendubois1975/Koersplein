import assert from 'node:assert/strict';
import {assessHistoricalCoverage as assess} from './europe-historical-quality-core.mjs';
import {isValidIsin} from './isin-identity-core.mjs';
import {addCalendarMonthsClamped,findMaturedHorizonBar} from './horizon-label-core.mjs';

const records=Array.from({length:5},(_,i)=>({identity:'TEST'+i,status:'HISTORY_AVAILABLE',provisionalIdentity:false,source:'verified-test-source',bars:260,firstDate:'2024-01-02',lastDate:'2025-01-02'}));
const evidence={catalogInstruments:5,usableInstruments:5,insufficientHistory:0,failed:0,missingIsin:0,provisionalIdentities:0,records};
const validCoverage={instruments:5,usableInstruments:5,observations:100,failed:0,insufficientHistory:0,skippedMissingIsin:0,provisionalIdentities:0};
const full = assess(validCoverage,evidence);
assert.equal(full.complete, true);
for (const input of [
  {instruments:0,usableInstruments:0,observations:0},
  {instruments:5,usableInstruments:4,observations:80},
  {instruments:5,usableInstruments:4,observations:80,insufficientHistory:1},
  {instruments:5,usableInstruments:5,observations:100,failed:1},
  {instruments:5,usableInstruments:6,observations:100},
  {instruments:-1,usableInstruments:0,observations:100},
  {instruments:5,usableInstruments:5,observations:-1},
  {instruments:5,usableInstruments:5,observations:Infinity}
]) assert.equal(assess(input,evidence).complete, false, JSON.stringify(input));

assert.equal(assess(validCoverage).complete,false,'aggregate-only must fail');
assert.equal(assess({...validCoverage,observations:1},evidence).complete,true,'signal rows are not bar counts');
for(const [name,detail] of [
 ['wrong catalog',{...evidence,catalogInstruments:4}],
 ['short records',{...evidence,records:records.slice(1)}],
 ['bad bar count',{...evidence,records:[{...records[0],bars:1},...records.slice(1)]}],
 ['missing source',{...evidence,records:[{...records[0],source:''},...records.slice(1)]}],
 ['missing date',{...evidence,records:[{...records[0],firstDate:null},...records.slice(1)]}],
 ['wrong status',{...evidence,records:[{...records[0],status:'INSUFFICIENT_HISTORY'},...records.slice(1)]}]
]) assert.equal(assess(validCoverage,detail).complete,false,name);

for (const isin of ['LU2458332611','CH0198251305','ES0125220311','GB00B1YW4409']) {
  assert.equal(isValidIsin(isin), true, isin);
}
for (const isin of ['XICE:ALVO','XICE:AMRQ',null,'','ES0125220312','LU2458332612','lu2458332611','WIG20']) {
  assert.equal(isValidIsin(isin), false, String(isin));
}

// Do not label a 3-month prediction with a return realized many months late.
assert.equal(addCalendarMonthsClamped('2024-01-31',1),'2024-02-29');
assert.equal(addCalendarMonthsClamped('2023-01-31',1),'2023-02-28');
assert.equal(addCalendarMonthsClamped('2020-01-31',3),'2020-04-30');
assert.equal(findMaturedHorizonBar([{date:'2020-12-31',close:150}],'2020-04-30'),null);
assert.equal(findMaturedHorizonBar([{date:'2024-05-03',close:101}],'2024-04-30')?.close,101);
assert.equal(findMaturedHorizonBar([{date:'2024-05-11',close:101}],'2024-04-30'),null);
assert.equal(findMaturedHorizonBar([{date:'2024-04-30',close:100}],'2024-04-30')?.close,100);
assert.equal(findMaturedHorizonBar([],'2024-04-30'),null);

console.log('EUROPE_HISTORICAL_COVERAGE_AND_ISIN_GATE_TEST_PASS');
