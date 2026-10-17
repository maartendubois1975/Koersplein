import assert from 'node:assert/strict';
import {FactoryApiClient} from './client.mjs';
const original=globalThis.fetch;
const client=new FactoryApiClient({baseUrl:'https://test.invalid',token:'test'});
client.credentials=async()=>'test';
let calls=0;
try{
 globalThis.fetch=async(url,options)=>{calls++;assert.ok(options.signal instanceof AbortSignal);return new Response('{"error":"missing"}',{status:404});};
 await assert.rejects(client.catalog(),/HTTP 404/);assert.equal(calls,1);
 globalThis.fetch=async(url,options)=>{assert.ok(options.signal instanceof AbortSignal);return new Response('{"instruments":[]}');};
 assert.deepEqual(await client.catalog(),{instruments:[]});
}finally{globalThis.fetch=original;}
console.log('Factory client: bounded request and no retries for permanent HTTP failures OK');
