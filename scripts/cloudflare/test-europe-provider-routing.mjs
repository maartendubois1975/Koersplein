import assert from 'node:assert/strict';
import {ProviderRegistry} from '../history/provider-registry.mjs';

const calls=[];
const make=(id,{supports=()=>true,bars=[],error=null}={})=>({
 id,supports,async fetchDaily(){calls.push(id);if(error)throw Error(error);return {bars};}
});
const good={date:'2026-10-22',open:10,close:11};
const registry=new ProviderRegistry([
 make('primary',{error:'primary unavailable'}),
 make('unapproved',{bars:[good]}),
 make('approved',{bars:[good]})
]);
const instrument={isin:'GB0000000001',mic:'XLON'};
const range={startDate:'2026-10-21',endDate:'2026-10-22'};
const result=await registry.fetchDaily(instrument,range,'primary',{allowedProviderIds:['primary','approved']});
assert.equal(result.provider.id,'approved');
assert.deepEqual(calls,['primary','approved'],'Unapproved global provider must never be attempted');
calls.length=0;
await assert.rejects(()=>registry.fetchDaily(instrument,range,'primary',{allowedProviderIds:['primary']}),/Alle providers faalden/);
assert.deepEqual(calls,['primary']);
calls.length=0;
await assert.rejects(()=>registry.fetchDaily(instrument,range,'primary',{allowedProviderIds:['not-installed']}),/Geen toegestane provider/);
assert.deepEqual(calls,[]);
console.log('Europe provider routing: approved fallback, rejected fallback, and empty allowlist PASS');

import fs from 'node:fs/promises';
const policy=JSON.parse(await fs.readFile('config/paris-follow-policy.json','utf8'));
const updateScript=await fs.readFile('scripts/cloudflare/daily-open-close-update.mjs','utf8');
assert.equal(policy.mode,'existing-history-only');
assert.match(updateScript,/const parisHistoryOnly=parisPolicy\.mode==='existing-history-only';/);
assert.match(updateScript,/const shares=allShares\.filter\(share=>!isInactiveParis\(share,market\.mic\)\)/);
assert.match(updateScript,/const fullRequested=process\.env\.EUROPE_FULL_BACKFILL==='1';/);
console.log('Paris existing-history-only and explicit full-backfill guard PASS');
