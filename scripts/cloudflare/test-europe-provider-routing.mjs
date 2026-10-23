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
assert.deepEqual(approvedFor('XTAL').slice(0,3),['nasdaq-baltic-official','yahoo-isin-resolver','yahoo-chart']);
assert.deepEqual(approvedFor('XLIT').slice(0,3),['nasdaq-baltic-official','yahoo-isin-resolver','yahoo-chart']);
const {NasdaqBalticProvider}=await import('../history/providers/nasdaq-baltic.mjs');
const baltic=new NasdaqBalticProvider();
for(const mic of ['XTAL','XLIT','XRIS'])assert.equal(baltic.supports({mic,isin:'EE3100008996'}),true, 'Official Nasdaq Baltic provider must support '+mic);
assert.equal(baltic.supports({mic:'XLON',isin:'EE3100008996'}),false);

assert.match(updateScript,/\['DISCOVERY_FALLBACK','FALLBACK'\]\.includes\(x\.role\)/);
console.log('Registered approved fallback routes for Paris, Switzerland, London and Sofia PASS');

const yahooChart=await fs.readFile('scripts/history/providers/yahoo-chart.mjs','utf8');
const yahooIsin=await fs.readFile('scripts/history/providers/yahoo-isin.mjs','utf8');
assert.match(yahooChart,/XSWX: \{ suffix: '\.SW'/);
assert.match(yahooChart,/XLON: \{ suffix: '\.L'/);
assert.match(yahooIsin,/chart\.marketRule\(instrument\)\?\.suffix/);
const {YahooIsinProvider}=await import('../history/providers/yahoo-isin.mjs');
const isinResolver=new YahooIsinProvider();
assert.equal(isinResolver.supports({mic:'XLON',isin:'GB0000000001'}),true);
assert.equal(isinResolver.supports({mic:'XSWX',isin:'CH0000000001'}),true);
for(const mic of ['XLUX','XLJU','XLIT','XTAL','XZAG','XBRA'])assert.equal(isinResolver.supports({mic,isin:'LU0056569402'}),false,'No arbitrary cross-exchange ISIN match for '+mic);
await assert.rejects(()=>isinResolver.fetchDaily({mic:'XLUX',isin:'LU0056569402'},{startDate:'2026-10-22',endDate:'2026-10-22'}),/Geen gevalideerde Yahoo-beursregel/);
console.log('Yahoo ISIN resolution requires canonical chart MIC suffix; Luxembourg cross-exchange bypass closed PASS');

const originalYahooFetch=globalThis.fetch,requestedYahoo=[];
try{
 globalThis.fetch=async url=>{
  requestedYahoo.push(String(url));
  if(String(url).includes('/v1/finance/search'))return {ok:true,async json(){return {quotes:[{symbol:'WRONG.PA'},{symbol:'WRONGISIN.L',isin:'FR0000000001',quoteType:'EQUITY'},{symbol:'ETF.L',quoteType:'ETF'},{symbol:'VALID.L',isin:'GB0000000001',quoteType:'EQUITY'}]};}};
  return {ok:true,async json(){return {chart:{result:[{
   meta:{symbol:'VALID.L',exchangeName:'LSE',fullExchangeName:'London Stock Exchange',currency:'GBP'},
   timestamp:[Math.floor(Date.parse('2026-10-22T12:00:00Z')/1000)],
   indicators:{quote:[{open:[10],high:[11],low:[9],close:[10.5],volume:[100]}]}
  }]}};}};
 };
 const found=await isinResolver.fetchDaily({mic:'XLON',isin:'GB0000000001'},{startDate:'2026-10-22',endDate:'2026-10-22'});
 assert.equal(found.providerMeta.symbol,'VALID.L');
 assert.equal(found.bars[0].close,10.5);
 assert.equal(requestedYahoo.length,2);
 assert.ok(!requestedYahoo.some(u=>u.includes('WRONG.PA')),'Do not fetch a matching ISIN on another exchange');
}finally{globalThis.fetch=originalYahooFetch;}
// Even on the correct .L exchange, an explicit conflicting ISIN or a
// non-equity quote cannot become a production ticker identity.
const rejectedCalls=[];
try{
 globalThis.fetch=async url=>{
  rejectedCalls.push(String(url));
  if(String(url).includes('/v1/finance/search'))return {ok:true,async json(){return {quotes:[
   {symbol:'OTHER.L',isin:'FR0000000001',quoteType:'EQUITY'},
   {symbol:'FUND.L',quoteType:'ETF'}
  ]};}};
  throw Error('Unverified Yahoo quote reached chart endpoint');
 };
 await assert.rejects(()=>isinResolver.fetchDaily({mic:'XLON',isin:'GB0000000001'},{startDate:'2026-10-22',endDate:'2026-10-22'}),/Geen Yahoo ISIN-resolutie/);
 assert.equal(rejectedCalls.length,1,'Conflicting ISIN and ETF matches must be rejected before chart fetch');
}finally{globalThis.fetch=originalYahooFetch;}
console.log('Yahoo ISIN resolver rejects explicit mismatched ISINs and non-equity quote types PASS');

console.log('Yahoo ISIN cross-exchange quote rejected; London validated .L quote accepted PASS');

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


// A validator must know which approved feed produced each source bar.
// Rejecting one feed must still allow the next approved fallback, in both
// normal and bounded-timeout registry paths.
for(const timeoutMs of [0,1000]){
 const observed=[];
 const candidates=new ProviderRegistry([
  make('first',{bars:[good]}),
  make('second',{bars:[good]})
 ]);
 const validated=await candidates.fetchDaily(instrument,range,'first',{
  allowedProviderIds:['first','second'],timeoutMs,
  acceptResult:(result,provider)=>{
   observed.push(provider?.id);
   return provider?.id==='second';
  }
 });
 assert.equal(validated.provider.id,'second');
 assert.deepEqual(observed,['first','second']);
}
console.log('Provider callback attribution and approved fallback work with and without timeout PASS');


// Empty provider responses must reach the callback ONLY for explicit read-only
// evidence collection. Production must reject empty bars before callbacks.
for(const timeoutMs of [0,1000]){
 const empty=new ProviderRegistry([make('empty',{bars:[]}),make('valid',{bars:[good]})]);
 const normal=[];
 const normalResult=await empty.fetchDaily(instrument,range,'empty',{
  timeoutMs,allowedProviderIds:['empty','valid'],acceptResult:(r,p)=>{normal.push(p.id);return true;}
 });
 assert.equal(normalResult.provider.id,'valid');
 assert.deepEqual(normal,['valid'],'Production callback must not receive empty bars');
 const evidence=[];
 const evidenceResult=await empty.fetchDaily(instrument,range,'empty',{
  timeoutMs,allowedProviderIds:['empty','valid'],inspectEmptyResult:true,
  acceptResult:(r,p)=>{evidence.push([p.id,r.bars.length]);if(!r.bars.length)throw Error('Source has no exact-date daily bar');return true;}
 });
 assert.equal(evidenceResult.provider.id,'valid');
 assert.deepEqual(evidence,[['empty',0],['valid',1]]);
 await assert.rejects(()=>empty.fetchDaily(instrument,range,'empty',{
  timeoutMs,strictPreferred:true,allowedProviderIds:['empty'],inspectEmptyResult:true,
  acceptResult:()=>true
 }),/Provider returned no daily bars/,'Opt-in cannot approve empty provider results');
}
console.log('Read-only empty source observation is opt-in; production never accepts empty bars PASS');


// Async source-identity/OHLC validation must be awaited before accepting bars.
// A Promise is truthy; without await, a rejected/false validation silently
// approves the first provider and can create unhandled rejections.
for(const timeoutMs of [0,1000]){
 const attempts=[];
 const asynchronous=new ProviderRegistry([
  {id:'unverified',supports:()=>true,async fetchDaily(){attempts.push('unverified');return {bars:[good]};}},
  {id:'verified',supports:()=>true,async fetchDaily(){attempts.push('verified');return {bars:[good]};}},
  {id:'forbidden',supports:()=>true,async fetchDaily(){throw Error('Unapproved source called');}}
 ]);
 const selected=await asynchronous.fetchDaily(instrument,range,'unverified',{
  timeoutMs,allowedProviderIds:['unverified','verified'],
  acceptResult:async (_result,provider)=>{await Promise.resolve();return provider.id==='verified';}
 });
 assert.equal(selected.provider.id,'verified','Async false must reject the unverified first provider');
 assert.deepEqual(attempts,['unverified','verified'],'No unapproved source can be attempted');
 const rejected=await asynchronous.fetchDaily(instrument,range,'unverified',{
  timeoutMs,allowedProviderIds:['unverified','verified'],
  acceptResult:async (_result,provider)=>{
   await Promise.resolve();
   if(provider.id==='unverified')throw Error('Async source identity mismatch');
   return true;
  }
 });
 assert.equal(rejected.provider.id,'verified','Async validator rejection must permit only approved fallback');
 await assert.rejects(()=>asynchronous.fetchDaily(instrument,range,'unverified',{
  timeoutMs,strictPreferred:true,allowedProviderIds:['unverified'],
  acceptResult:async()=>{await Promise.resolve();return false;}
 }),/Provider returned no usable bars/,'Async false must fail closed with no approved fallback');
 const emptyObserved=[];
 const emptyFirst=new ProviderRegistry([
  {id:'empty',supports:()=>true,async fetchDaily(){return {bars:[]};}},
  {id:'verified',supports:()=>true,async fetchDaily(){return {bars:[good]};}}
 ]);
 const afterEmpty=await emptyFirst.fetchDaily(instrument,range,'empty',{
  timeoutMs,inspectEmptyResult:true,allowedProviderIds:['empty','verified'],
  acceptResult:async (result,provider)=>{
   await Promise.resolve();
   emptyObserved.push(provider.id);
   if(!result.bars.length)throw Error('Async no exact-date source bar');
   return true;
  }
 });
 assert.equal(afterEmpty.provider.id,'verified');
 assert.deepEqual(emptyObserved,['empty','verified'],'Read-only async empty-bar evidence must finish before fallback');
}
console.log('Async source validators fail closed in normal and timeout registry paths PASS');
