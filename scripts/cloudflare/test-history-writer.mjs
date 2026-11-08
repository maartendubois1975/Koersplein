import assert from 'node:assert/strict';
import { writeCloudflareHistory } from './history-writer.mjs';
const calls=[];
const client={
  async putPartition(key,period,body){calls.push({op:'put',key,period,body});},
  async completeHistory(key,body){calls.push({op:'complete',key,body});return {first_date:'2026-01-01',last_date:'2026-01-02'};}
};
const bar=date=>({date,open:1,high:2,low:1,close:2,volume:100});
const result=await writeCloudflareHistory(client,'NL0000000001',[bar('2025-12-31'),bar('2026-01-02')],{provider:'test-provider'});
assert.equal(result.recordsAdded,2);
assert.equal(calls.filter(x=>x.op==='put').length,2);
assert.equal(calls.filter(x=>x.op==='complete').length,1);
assert.deepEqual(calls.filter(x=>x.op==='put').map(x=>x.period),['2025','2026']);
assert.deepEqual(await writeCloudflareHistory(client,'NL0000000001',[],{provider:'test-provider'}),{recordsAdded:0,coverage:null});
assert.equal(calls.length,3);
await assert.rejects(()=>writeCloudflareHistory(client,'',[],{provider:'test-provider'}),/key/);
await assert.rejects(()=>writeCloudflareHistory(client,'NL0000000001',[],{}),/provider/);
console.log('Shared Cloudflare history writer tests passed');
