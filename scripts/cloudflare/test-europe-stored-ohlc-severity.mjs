import assert from 'node:assert/strict';
import {storedOhlcViolationSeverity,summarizeStoredOhlcSeverity} from './europe-stored-ohlc-severity.mjs';
const bar={open:100,high:110,low:90,close:105};
assert.equal(storedOhlcViolationSeverity({...bar,high:104.99999}).bucket,'UNDER_1_BPS');
assert.equal(storedOhlcViolationSeverity({...bar,high:104.95}).bucket,'FROM_1_TO_10_BPS');
assert.equal(storedOhlcViolationSeverity({...bar,high:104.5}).bucket,'FROM_10_TO_100_BPS');
assert.equal(storedOhlcViolationSeverity({...bar,high:100}).bucket,'FROM_100_TO_1000_BPS');
assert.equal(storedOhlcViolationSeverity({...bar,high:90}).bucket,'AT_LEAST_1000_BPS');
assert.equal(storedOhlcViolationSeverity({...bar,low:106}).bucket,'FROM_100_TO_1000_BPS');
assert.equal(storedOhlcViolationSeverity({...bar,high:89,low:90}).bucket,'AT_LEAST_1000_BPS');
assert.equal(storedOhlcViolationSeverity(bar).bucket,'FLAGGED_WITHOUT_VIOLATION');
assert.equal(storedOhlcViolationSeverity({...bar,high:'104.5'}).bucket,'FROM_10_TO_100_BPS','Legacy decimal-string OHLC must have the same severity as numeric OHLC');
for(const value of [null,0,NaN,Infinity,true,false,[],[100],{},'0x64',' ',undefined])assert.equal(storedOhlcViolationSeverity({...bar,high:value}).bucket,'INVALID_OR_MISSING_FIELDS');
const row=(mic,isin,day,storedOhlc)=>({mic,isin,lastStoredDate:day,auditReason:'INCOMPLETE_OR_INVALID_OHLC',storedOhlc});
const queue={markets:[{mic:'XLON',recentOhlcDebt:[row('XLON','GB1','2026-10-22',{...bar,high:100}),row('XLON','GB2','2026-10-21',{...bar,low:null})]},{mic:'XPAR',recentOhlcDebt:[row('XPAR','FR1','2026-10-22',{...bar,high:104.99999})]}]};
queue.totals={recentOhlcDebtDates:3};
const snapshot=JSON.stringify(queue);
const summary=summarizeStoredOhlcSeverity(queue);
assert.equal(JSON.stringify(queue),snapshot,'Never mutate stored price evidence');
assert.equal(summary.readOnly,true);
assert.equal(summary.complete,true);
assert.equal(summarizeStoredOhlcSeverity({...queue,totals:{recentOhlcDebtDates:4}}).complete,false);
assert.equal(summary.examined,3);
assert.equal(summary.byMarket[0].mic,'XLON');
assert.equal(summary.byMarket[0].atLeast100Bps,1);
assert.equal(summary.counts.INVALID_OR_MISSING_FIELDS,1);
assert.equal(summary.counts.UNDER_1_BPS,1);
assert.equal(summary.counts.FROM_100_TO_1000_BPS,1);
assert.equal(summary.duplicateDates,0);
const duplicates={markets:[{mic:'XLON',recentOhlcDebt:[row('XLON','GB1','2026-10-22',{...bar,high:100}),row('XLON','GB1','2026-10-22',{...bar,high:99})]}]};
const d=summarizeStoredOhlcSeverity(duplicates);
assert.equal(d.examined,1);
assert.equal(d.duplicateDates,1);
assert.equal(d.conflictingSnapshots,1);
// Distinguish an actual same-date OHLC conflict from an equivalent legacy
// decimal-string snapshot. Reject raw invalid type collisions conservatively.
const equivalent={markets:[{mic:'XLON',recentOhlcDebt:[
 row('XLON','GB1','2026-10-22',{...bar,high:100}),
 row('XLON','GB1','2026-10-22',{...bar,high:'100.0'})
]}]};
const e=summarizeStoredOhlcSeverity(equivalent);
assert.equal(e.duplicateDates,1);
assert.equal(e.conflictingSnapshots,0,'Equivalent numeric legacy prices are not contradictory snapshots');
const rawInvalid={markets:[{mic:'XLON',recentOhlcDebt:[
 row('XLON','GB1','2026-10-22',{...bar,open:true}),
 row('XLON','GB1','2026-10-22',{...bar,open:'true'})
]}]};
assert.equal(summarizeStoredOhlcSeverity(rawInvalid).conflictingSnapshots,1,'Invalid boolean and string prices must not collapse');
assert.throws(()=>summarizeStoredOhlcSeverity({}),/unavailable/);
assert.throws(()=>summarizeStoredOhlcSeverity({markets:[{mic:'XLON',recentOhlcDebt:[{...row('XLON','GB1','2026-10-22',bar),mic:'XPAR'}]}]}),/Invalid stored OHLC evidence/);
console.log('Read-only stored OHLC intrinsic severity, materiality, missing values, duplicate evidence and immutability PASS');
