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

// The factory's COMPLETE flag must not describe incomplete XAMS week coverage.
let lastStatus=null,latestWrites=0;
const completeBars=[{date:'2026-10-19',open:10,high:12,low:9,close:11,volume:100},
 {date:'2026-10-20',open:10,high:12,low:9,close:11,volume:100}];
const completeEnv={FACTORY_TOKEN:'test-token',DB:{prepare(sql){return {args:[],bind(...args){this.args=args;return this},async first(){
 if(sql.includes('FROM instruments i'))return {id:2,isin:'XAMS:NL0000852564',mic:'XAMS',ticker:'AALB',currency:'EUR'};
 if(sql.includes('SUM(record_count)'))return {record_count:2,first_date:'2026-10-19',last_date:'2026-10-20'};
 if(sql.includes('FROM history_partitions'))return {object_key:'xams/2026.gz'};
 throw Error('Unexpected complete query '+sql);
},async run(){
 if(sql.includes('UPDATE history_status'))lastStatus=this.args[0];
 if(sql.includes('INSERT INTO latest_prices'))latestWrites++;
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
console.log('XAMS append-only strict OHLCV, provisional cutoff, identity and honest COMPLETE gates PASS');
