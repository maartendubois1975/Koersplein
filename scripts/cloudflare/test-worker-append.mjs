import assert from 'node:assert/strict';
import {gzipSync,gunzipSync} from 'node:zlib';
import {route} from '../../cloudflare/worker.mjs';
const existing=[{date:'2026-10-15',open:10,close:11,high:12,low:9}];
let writes=0,updates=0,written=[];
const env={FACTORY_TOKEN:'test-token',DB:{prepare(sql){return {bind(){return this},async first(){
 if(sql.includes('FROM instruments i'))return {id:1,isin:'XICE:TEST',mic:'XICE'};
 if(sql.includes('FROM history_partitions'))return {object_key:'legacy/2026.gz',checksum:'original'};
 throw Error('Unexpected query '+sql);
},async run(){updates++;assert.match(sql,/INSERT INTO history_partitions/);return {};}};}},HISTORY:{
 async get(key){assert.equal(key,'legacy/2026.gz');return {body:new Blob([gzipSync(existing.map(x=>JSON.stringify(x)).join('\n')+'\n')]).stream()};},
 async put(key,bytes){writes++;assert.equal(key,'history/v1/mic=XICE/isin=XICE:TEST/year=2026/prices.ndjson.gz');written=gunzipSync(bytes).toString().trim().split('\n').map(JSON.parse);}
}};
const request=bars=>new Request('https://test.invalid/api/factory/history/XICE:TEST/2026',{method:'PUT',headers:{authorization:'Bearer test-token','content-type':'application/json'},body:JSON.stringify({appendOnly:true,provider:'test',bars})});
let response=await route(request([{...existing[0],close:999}]),env);
assert.equal(response.status,200);assert.equal((await response.json()).unchanged,true);assert.equal(writes,0);assert.equal(updates,0);
response=await route(request([{...existing[0],close:999},{date:'2026-10-16',open:11,close:12,currency:'EUR'}]),env);
assert.equal(response.status,200);assert.equal(writes,1);assert.equal(updates,1);assert.equal(written.length,2);assert.equal(written[0].close,11);assert.equal(written[1].close,12);
console.log('Worker append: existing dates require no writes; new date preserves original prices and legacy object contents OK');

assert.equal(written[1].currency,'EUR');


// XAMS-specific regression: existing invalid legacy rows are immutable, but
// incoming new rows must satisfy the same strict traded-bar validator as the UI.
const xamsExisting=[{date:'2026-10-19',open:10,high:11,low:9,close:10.5,volume:0}];
let xamsWrites=0,xamsUpdates=0,xamsWritten=[];
const xamsEnv={FACTORY_TOKEN:'test-token',DB:{prepare(sql){return {bind(){return this},async first(){
 if(sql.includes('FROM instruments i'))return {id:2,isin:'XAMS:NL0000852564',mic:'XAMS',ticker:'AALB',currency:'EUR'};
 if(sql.includes('FROM history_partitions'))return {object_key:'xams/2026.gz',checksum:'original-xams'};
 throw Error('Unexpected XAMS query '+sql);
},async run(){xamsUpdates++;return {};}};}},HISTORY:{
 async get(){return {body:new Blob([gzipSync(xamsExisting.map(x=>JSON.stringify(x)).join('\n')+'\n')]).stream()};},
 async put(key,bytes){xamsWrites++;xamsWritten=gunzipSync(bytes).toString().trim().split('\n').map(JSON.parse);}
}};
const xamsRequest=(bars,extra={})=>new Request('https://test.invalid/api/factory/history/XAMS:NL0000852564/2026',{method:'PUT',headers:{authorization:'Bearer test-token','content-type':'application/json'},body:JSON.stringify({appendOnly:true,provider:'test',bars,...extra})});
const traded={date:'2026-10-20',open:10,high:12,low:9,close:11,volume:150,currency:'EUR'};
for(const invalid of [{...traded,volume:0},{...traded,volume:null},{...traded,high:10},{...traded,date:'2099-01-01'},{...traded,currency:'USD'}]){
 const result=await route(xamsRequest([invalid]),xamsEnv);
 assert.equal(result.status,422,'Reject invalid XAMS append '+JSON.stringify(invalid));
}
assert.equal(xamsWrites,0);assert.equal(xamsUpdates,0);
let xamsResponse=await route(xamsRequest([{...xamsExisting[0],close:999}]),xamsEnv);
assert.equal(xamsResponse.status,200);
assert.equal((await xamsResponse.json()).unchanged,true);
xamsResponse=await route(xamsRequest([{...xamsExisting[0],close:999},traded]),xamsEnv);
assert.equal(xamsResponse.status,200);
assert.equal(xamsWrites,1);assert.equal(xamsUpdates,1);
assert.equal(xamsWritten[0].close,10.5,'Never overwrite legacy XAMS record');
assert.equal(xamsWritten[1].volume,150,'Append only a verified traded bar');
assert.equal((await route(xamsRequest([traded],{ticker:'WRONG'}),xamsEnv)).status,422);
assert.equal((await route(xamsRequest([traded],{appendOnly:false}),xamsEnv)).status,409);

 
// Regression: an append-only write must not collapse two conflicting legacy
// rows on the same date. Those duplicates must remain visible to weekBars()
// as an INVALID session, not silently become a fabricated valid close.
const duplicateLegacy={...xamsExisting[0],close:10.75,volume:0,legacyAuditTag:'preserve-me'};
xamsExisting.push(duplicateLegacy);
let replayResponse=await route(xamsRequest([{...xamsExisting[0],close:999}]),xamsEnv);
assert.equal(replayResponse.status,200);
assert.equal((await replayResponse.json()).unchanged,true,'Duplicate-only replay must not rewrite R2');
assert.equal(xamsWrites,1,'No R2 write for legacy duplicate-only replay');
assert.equal(xamsUpdates,1,'No D1 write for legacy duplicate-only replay');
const nextTraded={...traded,date:'2026-10-21'};
const appendedResponse=await route(xamsRequest([nextTraded]),xamsEnv);
assert.equal(appendedResponse.status,200);
assert.equal(xamsWrites,2,'Exactly one R2 write for a genuinely new session');
assert.equal(xamsUpdates,2,'Exactly one D1 write for a genuinely new session');
assert.equal(xamsWritten.length,3,'Both legacy duplicate rows must survive the append');
assert.deepEqual(xamsWritten.filter(x=>x.date==='2026-10-19'),xamsExisting,
 'Do not normalize, drop or overwrite conflicting legacy rows');
assert.equal(xamsWritten[2].date,'2026-10-21','Only the new closed trading day may be added');
console.log('XAMS append-only preserves duplicate-date conflicts and raw legacy evidence PASS');


// The factory's COMPLETE flag must not describe incomplete XAMS week coverage.
let lastStatus=null,latestWrites=0,latestDates=[];
const completeBars=[{date:'2026-10-19',open:10,high:12,low:9,close:11,volume:100},
 {date:'2026-10-20',open:10,high:12,low:9,close:11,volume:100}];
const completeEnv={FACTORY_TOKEN:'test-token',DB:{prepare(sql){return {args:[],bind(...args){this.args=args;return this},async first(){
 if(sql.includes('FROM instruments i'))return {id:2,isin:'XAMS:NL0000852564',mic:'XAMS',ticker:'AALB',currency:'EUR'};
 if(sql.includes('SUM(record_count)'))return {record_count:2,first_date:'2026-10-19',last_date:'2026-10-20'};
 if(sql.includes('FROM history_partitions'))return {object_key:'xams/2026.gz'};
 throw Error('Unexpected complete query '+sql);
},async all(){
 if(sql.includes('FROM history_partitions'))return {results:[{object_key:'xams/2026.gz'}]};
 throw Error('Unexpected complete list query '+sql);
},async run(){
 if(sql.includes('UPDATE history_status'))lastStatus=this.args[0];
 if(sql.includes('INSERT INTO latest_prices')){latestWrites++;latestDates.push(this.args[1]);}
 return {};
}};}},HISTORY:{async get(){return {body:new Blob([gzipSync(completeBars.map(x=>JSON.stringify(x)).join('\n')+'\n')]).stream()};}}};
const completeRequest=()=>new Request('https://test.invalid/api/factory/history/XAMS:NL0000852564/complete',{method:'POST',headers:{authorization:'Bearer test-token','content-type':'application/json'},body:JSON.stringify({provider:'test'})});
let completeResponse=await route(completeRequest(),completeEnv);
assert.equal(completeResponse.status,200);
assert.equal((await completeResponse.json()).status,'PARTIAL');
assert.equal(lastStatus,'PARTIAL');
assert.equal(latestWrites,1);
completeBars.push(...['2026-10-21','2026-10-22','2026-10-23'].map(date=>({date,open:10,high:12,low:9,close:11,volume:100})));
completeResponse=await route(completeRequest(),completeEnv);
assert.equal((await completeResponse.json()).status,'COMPLETE');
assert.equal(lastStatus,'COMPLETE');
// A legacy foreign-currency bar and an in-progress Amsterdam session must
// never replace the latest verified, closed XAMS session.
const todayAmsterdam=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
completeBars.push({date:'2026-10-24',open:10,high:12,low:9,close:11,volume:100,currency:'USD'});
completeBars.push({date:todayAmsterdam,open:10,high:12,low:9,close:11,volume:100,currency:'EUR'});
completeResponse=await route(completeRequest(),completeEnv);
assert.equal((await completeResponse.json()).status,'COMPLETE');
assert.equal(latestDates.at(-1),'2026-10-23','Latest XAMS price must ignore foreign currency and current-day bars');
console.log('XAMS append-only strict OHLCV, provisional cutoff, identity and honest COMPLETE gates PASS');

// XAMS: a future-only partition must not hide the last real closed trading day.
const partitionsByKey={
 'xams/2099.gz':[{date:'2099-01-01',open:10,high:12,low:9,close:11,volume:100,currency:'EUR'}],
 'xams/2026.gz':[{date:'2026-10-23',open:20,high:23,low:19,close:22,volume:250,currency:'EUR'}],
 'xams/2025.gz':[{date:'2025-12-30',open:8,high:9,low:7,close:8.5,volume:50,currency:'EUR'}]
};
let repairedLatest=null,latestUpsertSql=null;
const partitionEnv={FACTORY_TOKEN:'test-token',DB:{prepare(sql){return {bind(...args){this.args=args;return this},
 async first(){
  if(sql.includes('FROM instruments i'))return {id:2,isin:'XAMS:NL0000852564',mic:'XAMS',ticker:'AALB',currency:'EUR'};
  if(sql.includes('SUM(record_count)'))return {record_count:3,first_date:'2025-12-30',last_date:'2099-01-01'};
  if(sql.includes('FROM history_partitions')&&sql.includes('period=?'))return {object_key:'xams/2026.gz'};
  throw Error('Unexpected partition query '+sql);
 },
 async all(){
  if(sql.includes('FROM history_partitions')&&sql.includes('ORDER BY period DESC'))return {results:[
   {object_key:'xams/2099.gz'},{object_key:'xams/2026.gz'},{object_key:'xams/2025.gz'}]};
  throw Error('Unexpected partition list query '+sql);
 },
 async run(){
  if(sql.includes('INSERT INTO latest_prices')){repairedLatest=this.args[1];latestUpsertSql=sql;}
  return {};
 }};}},HISTORY:{async get(key){return {body:new Blob([gzipSync(partitionsByKey[key].map(x=>JSON.stringify(x)).join('\n')+'\n')]).stream()};}}};
let partitionResult=await route(completeRequest(),partitionEnv);
assert.equal(partitionResult.status,200);
assert.equal(repairedLatest,'2026-10-23','Skip future-only latest partition and use real 2026 session');
assert.ok(!latestUpsertSql.includes('WHERE latest_prices.trading_date<=excluded.trading_date'),
 'XAMS must repair previously stored provisional/future latest_prices rows');
partitionsByKey['xams/2026.gz']=[{date:'2026-10-23',open:20,high:23,low:19,close:22,volume:250,currency:'USD'}];
repairedLatest=null;
partitionResult=await route(completeRequest(),partitionEnv);
assert.equal(partitionResult.status,200);
assert.equal(repairedLatest,'2025-12-30','Skip foreign-currency 2026 partition and fall back to last valid year');
console.log('XAMS latest-price recovery across partitions, closed-day/currency validation and invalid future latest repair PASS');
