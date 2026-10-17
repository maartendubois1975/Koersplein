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
 // If OIDC PUT is rejected, the configured dedicated credential is tried once.
 process.env.KOERSPLEIN_AUTH_MODE='github-oidc';
 const fallbackClient=new FactoryApiClient({baseUrl:'https://test.invalid',token:'legacy-secret'});
 fallbackClient.credentials=async()=>'oidc-token';
 const auth=[];
 globalThis.fetch=async(_url,opts)=>{auth.push(opts.headers.authorization);return new Response(JSON.stringify({ok:true}),{status:auth.length===1?401:200});};
 assert.deepEqual(await fallbackClient.seedCatalog({markets:[],instruments:[],createOnly:true}),{ok:true});
 assert.deepEqual(auth,['Bearer oidc-token','Bearer legacy-secret']);
 delete process.env.KOERSPLEIN_AUTH_MODE;
}finally{globalThis.fetch=original;}
console.log('Factory client: bounded request and no retries for permanent HTTP failures OK');
