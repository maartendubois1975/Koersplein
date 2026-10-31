import assert from 'node:assert/strict';
import {sessionReadiness} from './session-readiness.mjs';
const row=(isin,date,open=100,close=101)=>({isin,latestDate:date,open,close});
const complete=sessionReadiness([row('A','2026-10-30'),row('B','2026-10-30')],2);
assert.equal(complete.completeForObservedSession,true);
assert.equal(complete.newestDate,'2026-10-30');
assert.equal(complete.currentCount,2);
const partial=sessionReadiness([
  row('A','2026-10-30'),row('B','2026-10-29'),row('C','2026-10-30',null,100),
  {isin:'D',latestDate:null,error:'not found'}
],4);
assert.equal(partial.completeForObservedSession,false);
assert.equal(partial.currentCount,1);
assert.equal(partial.laggingCount,1);
assert.equal(partial.invalidCount,1);
assert.equal(partial.unavailableCount,1);
assert.equal(sessionReadiness([row('A','2026-10-30')],2).countMatches,false);
assert.equal(sessionReadiness([{latestDate:'2026-10-30',open:100,close:101},row('B','2026-10-30')],2).identityUnique,false);
assert.equal(sessionReadiness([],2).completeForObservedSession,false);
assert.equal(sessionReadiness([row('A','2026-10-30'),row('A','2026-10-30')],2).identityUnique,false);
assert.equal(sessionReadiness([{...row('A','2026-10-30'),rejectedRecords:1},row('B','2026-10-30')],2).invalidCount,1);
assert.equal(sessionReadiness([row('A','2026-02-30'),row('B','2026-10-30')],2).invalidCount,1);
assert.throws(()=>sessionReadiness([],0),/Invalid session universe/);
console.log('Amsterdam observed-session readiness fixtures passed');
