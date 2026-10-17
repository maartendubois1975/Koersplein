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
response=await route(request([{...existing[0],close:999},{date:'2026-10-16',open:11,close:12}]),env);
assert.equal(response.status,200);assert.equal(writes,1);assert.equal(updates,1);assert.equal(written.length,2);assert.equal(written[0].close,11);assert.equal(written[1].close,12);
console.log('Worker append: existing dates require no writes; new date preserves original prices and legacy object contents OK');
