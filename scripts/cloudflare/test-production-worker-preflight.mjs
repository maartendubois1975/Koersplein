import assert from 'node:assert/strict';
import {waitForProtectedWorker,verifyProductionWorker} from './production-worker-preflight.mjs';

const quiet={log(){},warn(){}};
const good=()=>({ok:true,status:200,json:async()=>({historyWritePolicy:'preserve-existing-listing-v1'})});
const wrong=()=>({ok:true,status:200,json:async()=>({historyWritePolicy:'allow-overwrite'})});
let attempts=0,waits=0;
await waitForProtectedWorker({baseUrl:'https://worker.example',attempts:3,delayMs:1,sleep:async()=>{waits++},logger:quiet,fetchImpl:async()=>{attempts++;if(attempts===1)throw Object.assign(Error('connect timeout'),{name:'ConnectTimeoutError'});return good()}});
assert.equal(attempts,2);assert.equal(waits,1,'Retry exactly once after a transient connect timeout');

let badPolicyCalls=0;
await assert.rejects(waitForProtectedWorker({baseUrl:'https://worker.example',attempts:3,sleep:async()=>{},logger:quiet,fetchImpl:async()=>{badPolicyCalls++;return wrong()}}),/not verified/);
assert.equal(badPolicyCalls,3,'A wrong policy never authorizes production');

await assert.rejects(waitForProtectedWorker({baseUrl:'https://worker.example',attempts:2,sleep:async()=>{},logger:quiet,fetchImpl:async()=>({ok:true,status:200,json:async()=>{throw SyntaxError('bad json')}})}),/not verified/);
let accessAttempts=0;
await assert.rejects(waitForProtectedWorker({baseUrl:'https://worker.example',attempts:3,sleep:async()=>{},logger:quiet,fetchImpl:async()=>{accessAttempts++;return {ok:false,status:403}}}),/access denied/);
assert.equal(accessAttempts,1,'Access denied is fail-closed, not retried');
await assert.rejects(waitForProtectedWorker({baseUrl:'http://worker.example',logger:quiet}),/HTTPS/);

const events=[];
const client={baseUrl:'https://worker.example',async catalog(){events.push('catalog')},async seedCatalog(payload){assert.deepEqual(payload,{markets:[],instruments:[],createOnly:true});events.push('seed')}};
await assert.rejects(verifyProductionWorker({client,healthCheck:async()=>{throw Error('policy mismatch')}}),/policy mismatch/);
assert.deepEqual(events,[],'Never attempt a catalog mutation after failed health gate');
await verifyProductionWorker({client,healthCheck:async()=>{events.push('health')}});
assert.deepEqual(events,['health','catalog','seed']);
console.log('Production Worker preflight PASS: transient retry, exact policy, auth fail-closed, write ordering');
