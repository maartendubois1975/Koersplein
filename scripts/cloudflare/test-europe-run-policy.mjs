import assert from 'node:assert/strict';
import {latestClosedWeekday,latestAuditBar,validBars,mapConcurrent} from './europe-run-policy.mjs';
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
assert.deepEqual(validBars({bars:[current,old,invalid,incomplete]},range),[current]);
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
