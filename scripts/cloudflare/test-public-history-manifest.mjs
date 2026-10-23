import assert from 'node:assert/strict';
import {fetchPublicHistoryManifest} from './public-history-manifest.mjs';
const url='https://factory.example';
const ok=entries=>({ok:true,json:async()=>({instruments:entries})});
const status=code=>({ok:false,status:code});
const run=async(responses,opts={})=>{
 const calls=[],delays=[],retries=[];
 const result=await fetchPublicHistoryManifest(url,{
  fetchImpl:async(u,init)=>{calls.push({url:u,headers:init.headers});const value=responses.shift();if(value instanceof Error)throw value;return value;},
  sleep:async ms=>delays.push(ms),onRetry:e=>retries.push(e),...opts
 });
 return {result,calls,delays,retries};
};
const a=await run([status(503),status(429),ok({GB123:{lastDate:'2026-10-22'}})],{shardIndex:5});
assert.equal(a.calls.length,3);
assert.equal(a.delays.length,3);
assert.deepEqual(a.result,{GB123:{lastDate:'2026-10-22'}});
assert.equal(a.retries.length,2);
const timeout=Object.assign(Error('The operation was aborted due to timeout'),{name:'TimeoutError'});
assert.equal((await run([timeout,ok({CH123:{lastDate:'2026-10-22'}})])).calls.length,2);
for(const bad of [status(403),ok({}),{ok:true,json:async()=>({instruments:[]})}]){
 let calls=0;
 await assert.rejects(fetchPublicHistoryManifest(url,{fetchImpl:async()=>{calls++;return bad;},sleep:async()=>{}}),/EUROPE_MANIFEST_UNAVAILABLE/);
 assert.equal(calls,1,'Permanent errors must not retry');
}
let calls=0;
await assert.rejects(fetchPublicHistoryManifest(url,{fetchImpl:async()=>{calls++;throw timeout;},sleep:async()=>{},onRetry:()=>{}}),/AFTER_4_ATTEMPTS/);
assert.equal(calls,4);
await assert.rejects(fetchPublicHistoryManifest('http://insecure.example'),/INVALID_BASE_URL/);
console.log('Europe public manifest retry, shard staggering, HTTP safety and fail-closed shape PASS');
