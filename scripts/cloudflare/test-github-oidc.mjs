import assert from 'node:assert/strict';
import { verifyGithubIdentity, allowsDailyRequest, OIDC_AUDIENCE } from '../../cloudflare/github-oidc.mjs';
import { route } from '../../cloudflare/worker.mjs';
const pair = await crypto.subtle.generateKey({ name:'RSASSA-PKCS1-v1_5', modulusLength:2048, publicExponent:new Uint8Array([1,0,1]), hash:'SHA-256' }, true, ['sign','verify']);
const jwk = { ...await crypto.subtle.exportKey('jwk', pair.publicKey), kid:'test-key', alg:'RS256', use:'sig' };
const time = Math.floor(Date.now()/1000);
const base = { iss:'https://token.actions.githubusercontent.com', aud:OIDC_AUDIENCE, repository:'maartendubois1975/Koersplein', repository_id:'1369316270', repository_owner_id:'305800938', ref:'refs/heads/main', workflow_ref:'maartendubois1975/Koersplein/.github/workflows/daily-open-close.yml@refs/heads/main', event_name:'push', runner_environment:'github-hosted', iat:time, nbf:time-1, exp:time+300 };
const enc = x => Buffer.from(JSON.stringify(x)).toString('base64url');
async function token(overrides={}, header={}) {
 const message=enc({alg:'RS256',typ:'JWT',kid:'test-key',...header})+'.'+enc({...base,...overrides});
 const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(message));
 return message+'.'+Buffer.from(signature).toString('base64url');
}
let keyCalls=0;
const options={fetchKeys:async url=>{assert.equal(url,'https://token.actions.githubusercontent.com/.well-known/jwks');keyCalls++;return Response.json({keys:[jwk]});}};
const valid=await token();
assert.equal(await verifyGithubIdentity(valid,options),true);
assert.equal(await verifyGithubIdentity(await token({job_workflow_ref:base.workflow_ref}),options),true);
for (const claims of [{repository_id:'1'},{repository_owner_id:'1'},{repository:'attacker/Koersplein'},{ref:'refs/heads/other'},{workflow_ref:'maartendubois1975/Koersplein/.github/workflows/evil.yml@refs/heads/main'},{job_workflow_ref:'external/workflow'},{event_name:'pull_request'},{aud:'other'},{iss:'https://evil.example'},{exp:time-1},{nbf:time+120},{iat:time-1000},{exp:time+3600},{runner_environment:'self-hosted'},{exp:'9999999999'}]) {
 assert.equal(await verifyGithubIdentity(await token(claims),options),false,JSON.stringify(claims));
}
assert.equal(await verifyGithubIdentity(await token({}, {alg:'none'}),options),false);
assert.equal(await verifyGithubIdentity(valid.slice(0,-10)+'AAAAAAAAAA',options),false);
assert.equal(await verifyGithubIdentity('undefined',options),false);
assert.equal(keyCalls,1);
for(const [method,path,allowed] of [['GET','/api/factory/catalog',true],['PUT','/api/factory/history/NL0010273215/2026',true],['POST','/api/factory/history/NL0010273215/complete',true],['PUT','/api/factory/catalog',false],['POST','/api/factory/jobs/1/claim',false],['DELETE','/api/factory/history/NL0010273215/2026',false],['POST','/api/admin/jobs',false]]) assert.equal(allowsDailyRequest(new Request('https://example.com'+path,{method})),allowed,path);
const db={prepare(){return {bind(){return this},async all(){return {results:[]}}}}};
const request=value=>new Request('https://example.com/api/factory/catalog',{headers:{authorization:'Bearer '+value}});
assert.equal((await route(request(valid),{DB:db})).status,200);
assert.equal((await route(request('undefined'),{DB:db})).status,401);
assert.equal((await route(request('legacy-secret'),{DB:db,FACTORY_TOKEN:'legacy-secret'})).status,200);
assert.equal((await route(new Request('https://example.com/api/factory/catalog',{method:'PUT',headers:{authorization:'Bearer '+valid}}),{DB:db})).status,401);
const seedRequest=body=>new Request('https://example.com/api/factory/catalog',{method:'PUT',headers:{authorization:'Bearer '+valid,'content-type':'application/json','x-koersplein-create-only':'1'},body:JSON.stringify(body)});
assert.equal((await route(seedRequest({createOnly:false}),{DB:db})).status,403);
assert.equal((await route(seedRequest({createOnly:true,markets:[{mic:'XICE'}]}),{DB:db})).status,403);
assert.equal((await route(seedRequest({createOnly:true,instruments:[{isin:'BARE-KEY',mic:'XICE'}]}),{DB:db})).status,400);
let inserts=0;
const seedDb={prepare(sql){return {bind(){return this},async first(){return null},async run(){assert.match(sql,/INSERT INTO (instruments|history_status)/);assert.doesNotMatch(sql,/UPDATE|DELETE/);if(sql.includes('INSERT INTO instruments'))inserts++;return {};}}}};
assert.equal((await route(seedRequest({createOnly:true,markets:[],instruments:[{isin:'XICE:TEST',mic:'XICE',ticker:'TEST',company:'Test'}]}),{DB:seedDb})).status,200);
assert.equal(inserts,1);
const existingDb={prepare(sql){return {bind(){return this},async first(){return sql.includes('WHERE isin=')?{mic:'XICE',ticker:'TEST'}:{id:1,isin:'XICE:TEST'}},async run(){throw Error('Existing listing must not be modified')}}}};
assert.equal((await route(seedRequest({createOnly:true,markets:[],instruments:[{isin:'XICE:TEST',mic:'XICE',ticker:'TEST',company:'Changed'}]}),{DB:existingDb})).status,200);
console.log('OIDC: valid signatures, strict repository/workflow scope, expiry, tampering, restricted routes, legacy auth, missing secret: OK');
