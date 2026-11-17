import assert from 'node:assert/strict';import {deployApprovedTest,TEST_SERVICE} from './deploy-approved-test.mjs';
assert.equal((await deployApprovedTest()).status,'BLOCKED_CREDENTIAL_ABSENT');
await assert.rejects(()=>deployApprovedTest({branch:'main'}),/NON_DEVELOPMENT/);
let calls=[];const sha='a99377c1d1e8684a374e580ab7484901e47223f1';
const service={id:TEST_SERVICE,name:'koersplein-test',type:'static_site',serviceDetails:{url:'https://koersplein-test.onrender.com'},repo:'https://github.com/maartendubois1975/Koersplein'};
const fake=async(url,options)=>{calls.push({url,method:options.method,body:options.body&&JSON.parse(options.body)});return {ok:true,json:async()=>calls.length===1?service:options.method==='POST'?{id:'dep-fixture'}:url.includes('/deploys/')?{status:'live',commit:{id:sha}}:{}}};
const report=await deployApprovedTest({apiKey:'fixture',commitSha:sha,fetchImpl:fake,wait:async()=>{}});assert.equal(report.status,'LIVE');assert.equal(report.commit,sha);assert(calls.every(c=>c.url.startsWith('https://api.render.com/v1/services/'+TEST_SERVICE)));assert.deepEqual(calls[1].body,{branch:'consolidation-20261116',autoDeployTrigger:'off'});assert.equal(calls[2].body.commitId,sha);
calls=[];await assert.rejects(()=>deployApprovedTest({apiKey:'fixture',commitSha:sha,fetchImpl:async()=>({ok:true,json:async()=>({...service,name:'koersplein',serviceDetails:{url:'https://koersplein.onrender.com'}})})}),/UNEXPECTED_RENDER_SERVICE/);assert.equal(calls.length,0);
console.log('Exact development commit and test-service-only deployment guards PASS');
