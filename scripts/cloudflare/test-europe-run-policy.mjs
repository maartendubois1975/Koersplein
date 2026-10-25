import assert from 'node:assert/strict';
import {latestClosedWeekday,latestAuditBar,selectEuropeAuditHistoryPeriods,validBars,inspectDailyBarIntegrity,parseOhlcPrice,isCompleteOhlcBar,auditBarIssue,mapConcurrent} from './europe-run-policy.mjs';
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
for(const invalidPrice of [true,false,[],[12],{},'0xC','0b1100','Infinity',' ',null,undefined]){
 assert.equal(parseOhlcPrice(invalidPrice),null,'Coercible non-price value must be rejected: '+String(invalidPrice));
 assert.equal(isCompleteOhlcBar({...current,open:invalidPrice}),false);
 assert.deepEqual(validBars({bars:[{...current,open:invalidPrice}]},range),[],'Never import coerced non-price OHLC');
}
for(const goodPrice of [12,'12',' 12.00 ','1.2e1']){
 assert.equal(parseOhlcPrice(goodPrice),12);
 assert.equal(isCompleteOhlcBar({...current,open:goodPrice}),true);
}
assert.equal(parseOhlcPrice('1e999'),null);
assert.equal(parseOhlcPrice('-5'),null);
assert.deepEqual(validBars({bars:[current,{...current,open:'12.00'}]},range),[current],'Equivalent decimal representations must not create a source conflict');
console.log('OHLC import rejects Boolean, array, hex and object coercion; decimal-string legacy values remain valid PASS');

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


// Yearly partition selection must preserve both halves of a 30-day window
// crossing New Year. It must not infer or fabricate an absent year.
const yearPartitions=[{period:'2024'},{period:'2025'},{period:'2026'},{period:'2027'}];
assert.deepEqual(selectEuropeAuditHistoryPeriods(yearPartitions,'2026-01-09',30),['2025','2026','2027']);
assert.deepEqual(selectEuropeAuditHistoryPeriods(yearPartitions,'2026-10-23',30),['2026','2027']);
assert.deepEqual(selectEuropeAuditHistoryPeriods([{period:'2023'},{period:'2024'}],'2026-01-09',30),['2024'],'Keep last available stored history for stale classification');
assert.deepEqual(selectEuropeAuditHistoryPeriods([{period:'2025'},{period:'2025'}],'2026-01-09',30),['2025'],'Duplicate metadata cannot cause duplicate requests');
assert.deepEqual(selectEuropeAuditHistoryPeriods([],'2026-01-09',30),[]);
assert.throws(()=>selectEuropeAuditHistoryPeriods(yearPartitions,'2026-02-30',30),/Invalid history audit window/);
assert.throws(()=>selectEuropeAuditHistoryPeriods([{period:'2026-01'}],'2026-01-09',30),/Invalid yearly history partition/);
console.log('Europe yearly history audit spans calendar-year rollover without inventing missing partitions PASS');

const zeroVolumeReference={date:'2026-10-23',open:72,high:72,low:72,close:72,volume:0};
assert.equal(isCompleteOhlcBar(zeroVolumeReference),true,'OHLC shape alone does not prove an executed trade');
assert.equal(auditBarIssue(zeroVolumeReference,'2026-10-23','2026-10-25'),'ZERO_VOLUME_REFERENCE_BAR');
assert.equal(auditBarIssue({...zeroVolumeReference,volume:10},'2026-10-23','2026-10-25'),null);
console.log('Immutable audit excludes zero-volume reference candles from traded coverage PASS');
