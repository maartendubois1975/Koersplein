import assert from 'node:assert/strict';
import {ProviderRegistry} from '../history/provider-registry.mjs';
import {YahooChartProvider} from '../history/providers/yahoo-chart.mjs';

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
assert.match(updateScript,/parisHistoryEligible\(share,marketMic,parisPolicy,manifest,resolveExisting\)/);
assert.match(updateScript,/const shares=allShares\.filter\(share=>!isInactiveParis\(share,market\.mic\)\)/);
assert.match(updateScript,/const fullRequested=process\.env\.EUROPE_FULL_BACKFILL==='1';/);
console.log('Paris existing-history-only and explicit full-backfill guard PASS');

const sourceRegistry=JSON.parse(await fs.readFile('data/market-source-registry.json','utf8'));
const approvedFor=mic=>{
 const sources=sourceRegistry.markets[mic].historySources;
 const primary=sources.find(x=>x.role==='PRIMARY')?.provider;
 return [primary,...sources.filter(x=>['DISCOVERY_FALLBACK','FALLBACK'].includes(x.role)&&x.provider!==primary).map(x=>x.provider)];
};
assert.deepEqual(approvedFor('XPAR').slice(0,2),['yahoo-chart','euronext-live']);
assert.deepEqual(approvedFor('XSWX').slice(0,2),['yahoo-chart','yahoo-isin-resolver']);
assert.deepEqual(approvedFor('XLON').slice(0,2),['yahoo-chart','yahoo-isin-resolver']);
assert.deepEqual(approvedFor('XBUL').slice(0,3),['bse-sofia-official','yahoo-isin-resolver','yahoo-chart']);
assert.match(updateScript,/\['DISCOVERY_FALLBACK','FALLBACK'\]\.includes\(x\.role\)/);
console.log('Registered approved fallback routes for Paris, Switzerland, London and Sofia PASS');

const yahooChart=await fs.readFile('scripts/history/providers/yahoo-chart.mjs','utf8');
const yahooIsin=await fs.readFile('scripts/history/providers/yahoo-isin.mjs','utf8');
assert.match(yahooChart,/XSWX: \{ suffix: '\.SW'/);
assert.match(yahooChart,/XLON: \{ suffix: '\.L'/);
assert.match(yahooIsin,/XSWX:'\.SW'/);
assert.match(yahooIsin,/XLON:'\.L'/);
console.log('London and Swiss chart/ISIN market suffix agreement PASS');

const yahoo=new YahooChartProvider();
assert.equal(yahoo.supports({isin:'AT0000KTMI02',mic:'XSWX',ticker:'41860974'}),false,'SIX numeric valor is not a verified Yahoo ticker');
assert.equal(yahoo.supports({isin:'AT0000KTMI02',mic:'XSWX',ticker:'41860974',providerSymbol:'BMAG.SW'}),true,'Explicit verified symbol remains supported');
assert.equal(yahoo.supports({isin:'GB0000000001',mic:'XLON',ticker:'1234'}),true,'Non-Swiss markets remain unchanged');
calls.length=0;
const skipUnsupported=new ProviderRegistry([make('not-supported',{supports:()=>false,error:'should never be called'}),make('resolver',{bars:[good]})]);
const resolved=await skipUnsupported.fetchDaily(instrument,range,'not-supported',{allowedProviderIds:['not-supported','resolver']});
assert.equal(resolved.provider.id,'resolver');
assert.deepEqual(calls,['resolver']);
await assert.rejects(()=>skipUnsupported.fetchDaily(instrument,range,'not-supported',{strictPreferred:true,allowedProviderIds:['not-supported']}),/Geen toegestane provider/);
console.log('SIX valor guard and unsupported preferred-provider skip PASS');

const swissCatalog=JSON.parse(await fs.readFile('data/euronext-zurich.json','utf8'));
const dsfir=swissCatalog.shares.find(s=>s.isin==='CH1216478797');
assert.equal(dsfir.symbol,'121647879','Preserve SIX catalog identity/valor');
assert.equal(dsfir.providerSymbol,'DSFIR.SW','Verified Swiss Yahoo provider symbol');
assert.equal(yahoo.supports(dsfir),true);
console.log('Verified Swiss provider-symbol override without catalog identity mutation PASS');
