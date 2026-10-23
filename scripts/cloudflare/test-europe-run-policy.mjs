import assert from 'node:assert/strict';
import {latestClosedWeekday,latestAuditBar,validBars,inspectDailyBarIntegrity,mapConcurrent} from './europe-run-policy.mjs';
import {ProviderRegistry} from '../history/provider-registry.mjs';
import {mergeHistoryPartition} from '../../cloudflare/worker.mjs';
assert.equal(latestClosedWeekday(new Date('2026-10-17T08:00:00Z')),'2026-10-16');
assert.equal(latestClosedWeekday(new Date('2026-10-19T07:00:00Z')),'2026-10-16');
assert.equal(latestClosedWeekday(new Date('2026-10-19T18:45:00Z')),'2026-10-19');
const range={startDate:'2026-10-15',endDate:'2026-10-16'};
const old={date:'2026-10-14',open:10,high:12,low:9,close:11};
const current={date:'2026-10-16',open:12,high:14,low:11,close:13};
const invalid={date:'2026-10-16',open:Infinity,high:14,low:11,close:13};
const incomplete={date:'2026-10-16',open:12,high:null,low:11,close:13};
assert.deepEqual(validBars({bars:[current,old,invalid,incomplete]},range),[],'Mixed complete/invalid same-day rows must be quarantined, not arbitrarily accepted');
const registry=new ProviderRegistry([
 {id:'stale',fetchDaily:async()=>({bars:[old]})},
 {id:'fresh',fetchDaily:async()=>({bars:[current]})}
]);
const result=await registry.fetchDaily({isin:'test'},range,'stale',{timeoutMs:100,acceptResult:r=>validBars(r,range).length>0});
assert.equal(result.provider.id,'fresh');
const merged=mergeHistoryPartition([current],[{...current,close:999},old],true);
assert.equal(merged.length,2);assert.equal(merged[1].close,13);
let active=0,max=0,done=0;
await mapConcurrent([1,2,3,4,5],2,async()=>{active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,2));active--;done++;});
assert.equal(done,5);assert.equal(max,2);
console.log('Europe run: daily freshness, stale-provider fallback, bounded concurrency and preserved historical bars OK');

assert.deepEqual(latestAuditBar([incomplete,current]),current,'Complete same-day bar must win when stored after incomplete');
assert.deepEqual(latestAuditBar([current,incomplete]),current,'Complete same-day bar must win independent of storage order');
assert.deepEqual(latestAuditBar([{...current,date:'2026-10-17'},incomplete,current],'2026-10-16'),current,'Ignore a later unclosed session');
assert.deepEqual(latestAuditBar([{...current,date:'2026-10-17'},current],'2026-10-16'),current);
assert.equal(latestAuditBar([{...current,date:'2026-02-30'}]),null,'Reject impossible stored dates');
console.log('Latest OHLC audit handles unsorted partitions, duplicate candles and unclosed sessions PASS');


// A provider can return two individually valid but contradictory OHLC bars for
// the same session. Neither row may be appended; other dates remain eligible.
const prior={date:'2026-10-15',open:8,high:11,low:7,close:10};
const conflict={...current,close:12};
const contradictory=inspectDailyBarIntegrity({bars:[prior,current,conflict]},range);
assert.deepEqual(contradictory.bars,[prior]);
assert.deepEqual(contradictory.conflicts,[{date:'2026-10-16',code:'CONFLICTING_COMPLETE_OHLC',completeRows:2,invalidRows:0}]);
assert.deepEqual(validBars({bars:[prior,conflict,current]},range),[prior],'Reversed provider order must not change safe OHLC');
assert.deepEqual(validBars({bars:[current,{...current}]},range),[current],'Identical complete duplicates are safe to deduplicate');
const mixed=inspectDailyBarIntegrity({bars:[prior,current,incomplete]},range);
assert.deepEqual(mixed.bars,[prior]);
assert.equal(mixed.conflicts[0].code,'MIXED_COMPLETE_INVALID_OHLC');
assert.deepEqual(validBars({bars:[prior,invalid]},range),[prior],'An invalid date does not block unrelated valid history');
assert.deepEqual(validBars({bars:[{...current,date:'2026-02-30'},prior]},range),[prior],'Impossible source dates must be ignored');
const sourceSnapshot=JSON.stringify([prior,current,conflict,incomplete]);
inspectDailyBarIntegrity({bars:[prior,current,conflict,incomplete]},range);
assert.equal(JSON.stringify([prior,current,conflict,incomplete]),sourceSnapshot,'Source quarantine must not mutate raw evidence');
const ambiguousRegistry=new ProviderRegistry([
 {id:'ambiguous',fetchDaily:async()=>({bars:[current,conflict]})},
 {id:'independent',fetchDaily:async()=>({bars:[current]})}
]);
const approved=await ambiguousRegistry.fetchDaily({isin:'test'},range,'ambiguous',{acceptResult:r=>validBars(r,range).length>0});
assert.equal(approved.provider.id,'independent','Contradictory primary must fall back to approved alternate source');
console.log('Europe source duplicate-date quarantine PASS: conflicting complete, mixed invalid, safe history and fallback');
