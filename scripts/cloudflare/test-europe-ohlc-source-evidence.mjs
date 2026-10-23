import assert from 'node:assert/strict';
import {selectIncompleteOhlcCandidates,probeIncompleteOhlcCandidate,approvedCatalogListingMic,isCompleteOhlcSourceBar} from './europe-ohlc-source-evidence.mjs';
const item={mic:'XLON',isin:'GB0000000001',symbol:'TEST',lastStoredDate:'2026-10-22',auditReason:'INCOMPLETE_OR_INVALID_OHLC'};
const queue={markets:[{mic:'XLON',instruments:[item,{...item,isin:'GB0000000002',auditReason:'STALE_LAST_TRADE'}]},{mic:'XPAR',instruments:[{...item,mic:'XPAR',isin:'FR0000000001'}]}]};
assert.equal(selectIncompleteOhlcCandidates(queue).length,2);
assert.equal(selectIncompleteOhlcCandidates(queue,{limit:1}).length,1);
assert.throws(()=>selectIncompleteOhlcCandidates(queue,{limit:0}),/Invalid OHLC probe limits/);
const market={mic:'XLON',currency:'GBX'};
const listings=[{mic:'XLON',isin:item.isin,symbol:'TEST',currency:'GBX'}];
const sources={status:'APPROVED',historySources:[{role:'PRIMARY',provider:'good'},{role:'FALLBACK',provider:'backup'},{role:'CANDIDATE_PAID',provider:'unapproved'}]};
const calls=[];
const registry={get:id=>id==='good'||id==='backup'?{id}:null,async fetchDaily(i,range,primary,opts){calls.push({i,range,primary,opts});return {provider:{id:'good'},result:{bars:[{date:'2026-10-22',open:100,high:110,low:90,close:105}],providerMeta:{currency:'GBX'}}};}};
const res=await probeIncompleteOhlcCandidate(item,{registry,sources,market,listings});
assert.equal(res.status,'COMPLETE_BAR_CANDIDATE_REQUIRES_CORRECTION_REVIEW');
assert.equal(res.storagePolicy,'APPEND_ONLY_EXISTING_BAR_UNCHANGED');
assert.deepEqual(calls[0].opts.allowedProviderIds,['good','backup']);
assert.equal(calls[0].i.currency,'GBX');
assert.equal((await probeIncompleteOhlcCandidate(item,{registry,sources,market,listings:[{...listings[0],symbol:'WRONG'}]})).status,'CATALOG_SYMBOL_CHANGED_REQUIRES_REVIEW');
assert.equal((await probeIncompleteOhlcCandidate(item,{registry,sources:{...sources,status:'CANDIDATE'},market,listings})).status,'NO_APPROVED_MARKET_ROUTE');
assert.equal((await probeIncompleteOhlcCandidate(item,{registry,sources,market,listings:[...listings,...listings]})).status,'AMBIGUOUS_CATALOG_ISIN_MIC');
const failed=await probeIncompleteOhlcCandidate(item,{registry:{...registry,async fetchDaily(){throw Error('Yahoo HTTP 404')}},sources,market,listings});
assert.equal(failed.status,'NO_COMPLETE_APPROVED_SOURCE_BAR');
console.log('Read-only incomplete OHLC provider evidence, exact identity, and approved allowlist PASS');

const rotatingQueue={markets:[{mic:'XLON',instruments:Array.from({length:5},(_,index)=>({...item,isin:'GB000000000'+index}))}]};
const first=selectIncompleteOhlcCandidates(rotatingQueue,{limit:2,perMarket:2,rotation:0});
const second=selectIncompleteOhlcCandidates(rotatingQueue,{limit:2,perMarket:2,rotation:1});
assert.equal(first.length,2);
assert.equal(second.length,2);
assert.ok(first.every(x=>!second.some(y=>y.isin===x.isin)),'Rotated probe must advance beyond first fixed batch');
assert.deepEqual(selectIncompleteOhlcCandidates(rotatingQueue,{limit:2,perMarket:2,rotation:1}),second,'Same run rotation must be reproducible');
assert.throws(()=>selectIncompleteOhlcCandidates(rotatingQueue,{rotation:-1}),/Invalid OHLC probe limits/);
assert.deepEqual(res.candidateBar,{date:'2026-10-22',open:100,high:110,low:90,close:105,volume:null});
assert.equal(res.currencyVerified,true);
const gbpence={...registry,async fetchDaily(){return {provider:{id:'good'},result:{bars:[{date:'2026-10-22',open:100,high:110,low:90,close:105}],providerMeta:{currency:'GBp'}}};}};
assert.equal((await probeIncompleteOhlcCandidate(item,{registry:gbpence,sources,market,listings})).status,'COMPLETE_BAR_CANDIDATE_REQUIRES_CORRECTION_REVIEW','GBp and GBX are both pence');
const wrongCurrency={...registry,async fetchDaily(){return {provider:{id:'good'},result:{bars:[{date:'2026-10-22',open:100,high:110,low:90,close:105}],providerMeta:{currency:'GBP'}}};}};
assert.equal((await probeIncompleteOhlcCandidate(item,{registry:wrongCurrency,sources,market,listings})).status,'SOURCE_CURRENCY_MISMATCH_REQUIRES_REVIEW','GBP pounds must never be treated as GBX pence');
const missingCurrency={...registry,async fetchDaily(){return {provider:{id:'good'},result:{bars:[{date:'2026-10-22',open:100,high:110,low:90,close:105}],providerMeta:{}}};}};
assert.equal((await probeIncompleteOhlcCandidate(item,{registry:missingCurrency,sources,market,listings})).status,'SOURCE_CURRENCY_UNVERIFIED');
console.log('Rotating OHLC read-only coverage and exact source candle/currency evidence PASS');

const historicalOnly={...item,isin:'GB0000000099',lastStoredDate:'2026-10-17',ohlcDefects:['MISSING_HIGH'],evidenceScope:'RECENT_STORED_HISTORY'};
const historicalQueue={markets:[
 {mic:'XLON',instruments:[item],recentOhlcDebt:[historicalOnly,{...item,evidenceScope:'RECENT_STORED_HISTORY'}]},
 {mic:'XSWX',instruments:[],recentOhlcDebt:[{...historicalOnly,mic:'XSWX',isin:'CH0000000001'}]}
]};
const selected=selectIncompleteOhlcCandidates(historicalQueue,{limit:10,perMarket:10,rotation:0});
assert.equal(selected.length,3,'Latest bar and identical historical date must not be probed twice');
assert.equal(selected.filter(x=>x.evidenceScope==='RECENT_STORED_HISTORY').length,2);
assert.equal(selected[0].mic,'XLON');
assert.equal(selected[1].mic,'XSWX','Round robin must include Switzerland before consuming another London slot');
assert.equal((await probeIncompleteOhlcCandidate(historicalOnly,{registry,sources,market,listings})).evidenceScope,'RECENT_STORED_HISTORY');
const manyMarkets={markets:['XLON','XSWX','XPAR','XMAL'].map(mic=>({mic,instruments:Array.from({length:5},(_,i)=>({...item,mic,isin:mic+i}))}))};
const diverse=selectIncompleteOhlcCandidates(manyMarkets,{limit:4,perMarket:3,rotation:0});
assert.equal(new Set(diverse.map(x=>x.mic)).size,4,'A 30-slot budget must not starve smaller European exchanges');
assert.deepEqual(selectIncompleteOhlcCandidates(manyMarkets,{limit:4,perMarket:3,rotation:0}),diverse);
assert.notEqual(selectIncompleteOhlcCandidates(manyMarkets,{limit:1,perMarket:3,rotation:1})[0].mic,diverse[0].mic,'Market rotation must move the starting exchange');
console.log('Historical OHLC debt, latest-date deduplication and fair European market sampling PASS');

const parisItem={...item,mic:'XPAR',isin:'FR0013341781',symbol:'AL2SI'};
const parisMarket={mic:'XPAR',currency:'EUR'};
const parisListing={mic:'ALXP',isin:parisItem.isin,symbol:parisItem.symbol,currency:'EUR'};
const euroRegistry={...registry,async fetchDaily(i,range,primary,opts){
 assert.equal(i.mic,'ALXP','The original Paris Growth board MIC must reach the provider');
 assert.equal(i.market,'ALXP');
 return {provider:{id:'good'},result:{bars:[{date:'2026-10-22',open:10,high:12,low:9,close:11}],providerMeta:{currency:'EUR'}}};
}};
assert.equal(approvedCatalogListingMic('XPAR','ALXP'),true);
assert.equal(approvedCatalogListingMic('XPAR','XMLI'),true);
assert.equal(approvedCatalogListingMic('XPAR','XNYS'),false);
assert.equal(approvedCatalogListingMic('XLON','ALXP'),false);
const parisEvidence=await probeIncompleteOhlcCandidate(parisItem,{registry:euroRegistry,sources,market:parisMarket,listings:[parisListing]});
assert.equal(parisEvidence.status,'COMPLETE_BAR_CANDIDATE_REQUIRES_CORRECTION_REVIEW');
assert.equal(parisEvidence.mic,'XPAR','Audit parent MIC must remain stable');
assert.equal(parisEvidence.listingMic,'ALXP','Evidence must disclose the true listing MIC');
assert.equal((await probeIncompleteOhlcCandidate(parisItem,{registry:euroRegistry,sources,market:parisMarket,listings:[{...parisListing,mic:'XNYS'}]})).status,'UNAPPROVED_CATALOG_SUBMARKET','Cross-exchange catalogue injection must fail closed');
assert.equal((await probeIncompleteOhlcCandidate(parisItem,{registry:euroRegistry,sources,market:parisMarket,listings:[parisListing,{...parisListing,mic:'XMLI'}]})).status,'AMBIGUOUS_CATALOG_ISIN_MIC','Two child-board listings for one ISIN cannot be guessed');
assert.equal((await probeIncompleteOhlcCandidate(parisItem,{registry:euroRegistry,sources,market:parisMarket,listings:[{...parisListing,isin:'FR9999999999'}]})).status,'NO_EXACT_CATALOG_ISIN_MIC');
console.log('Approved parent/child market identity, Paris Growth OHLC evidence and cross-market rejection PASS');

const weightedQueue={markets:[
 {mic:'XLON',instruments:Array.from({length:200},(_,i)=>({...item,mic:'XLON',isin:'GB'+String(i).padStart(10,'0')}))},
 {mic:'XSWX',instruments:Array.from({length:8},(_,i)=>({...item,mic:'XSWX',isin:'CH'+String(i).padStart(10,'0')}))},
 {mic:'XLIS',instruments:Array.from({length:2},(_,i)=>({...item,mic:'XLIS',isin:'PT'+String(i).padStart(10,'0')}))},
 {mic:'XPAR',instruments:[{...item,mic:'XPAR',isin:'FR0000000001'}]}
]};
const weighted=selectIncompleteOhlcCandidates(weightedQueue,{limit:24,perMarket:20,rotation:0});
assert.equal(weighted.length,24);
assert.equal(new Set(weighted.map(x=>x.mic)).size,4,'Even a tiny market gets a first-pass probe');
assert.ok(weighted.filter(x=>x.mic==='XLON').length>=15,'Largest historical debt must get substantial follow-up slots');
assert.equal(new Set(weighted.map(x=>x.mic+'|'+x.isin+'|'+x.lastStoredDate)).size,weighted.length,'No duplicated read-only probe');
assert.deepEqual(selectIncompleteOhlcCandidates(weightedQueue,{limit:24,perMarket:20,rotation:0}),weighted);
assert.notEqual(selectIncompleteOhlcCandidates(weightedQueue,{limit:1,perMarket:20,rotation:1})[0].mic,'XLON','Market fairness rotates across runs');
console.log('Debt-weighted source probe allocates substantial London coverage without starving small markets PASS');


// Regression: validBars only requires OPEN/CLOSE, so the repair-evidence path
// must independently enforce complete HIGH/LOW and valid OHLC inequalities.
const goodCandle={date:'2026-10-22',open:100,high:110,low:90,close:105};
assert.equal(isCompleteOhlcSourceBar(goodCandle),true);
for(const partial of [
 {...goodCandle,high:null},
 {...goodCandle,low:null},
 {...goodCandle,high:undefined},
 {...goodCandle,low:0},
 {...goodCandle,high:104},
 {...goodCandle,low:101},
 {...goodCandle,high:89},
 {...goodCandle,high:Infinity},
 {...goodCandle,low:NaN},
 {...goodCandle,open:'100'}
]){
 assert.equal(isCompleteOhlcSourceBar(partial),false,'Invalid or missing OHLC must not be repair-ready');
 const partialRegistry={...registry,async fetchDaily(i,range,primary,opts){
  assert.equal(opts.acceptResult({bars:[partial]}),false,'Provider acceptance must reject incomplete HIGH/LOW');
  return {provider:{id:'good'},result:{bars:[partial],providerMeta:{currency:'GBX'}}};
 }};
 const probe=await probeIncompleteOhlcCandidate(item,{registry:partialRegistry,sources,market,listings});
 assert.equal(probe.status,'NO_COMPLETE_APPROVED_SOURCE_BAR');
 assert.equal(probe.candidateBar,undefined,'Never publish a partial bar as correction evidence');
}
console.log('Source evidence rejects missing/invalid HIGH/LOW, inconsistent OHLC and numeric-string candles PASS');
