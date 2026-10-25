import assert from 'node:assert/strict';
import {selectIncompleteOhlcCandidates,probeIncompleteOhlcCandidate,approvedCatalogListingMic,isCompleteOhlcSourceBar,compareStoredAndSourceOhlc,classifyOhlcDifferenceMagnitude,summarizeOhlcProbeCoverage,describeExactDateSourceBars,summarizeOhlcSourceBarDiagnostics,sourceFeedFamily} from './europe-ohlc-source-evidence.mjs';
const item={mic:'XLON',isin:'GB0000000001',symbol:'TEST',lastStoredDate:'2026-10-22',auditReason:'INCOMPLETE_OR_INVALID_OHLC'};
const queue={markets:[{mic:'XLON',instruments:[item,{...item,isin:'GB0000000002',auditReason:'STALE_LAST_TRADE'}]},{mic:'XPAR',instruments:[{...item,mic:'XPAR',isin:'FR0000000001'}]}]};
assert.equal(selectIncompleteOhlcCandidates(queue).length,2);
assert.equal(selectIncompleteOhlcCandidates(queue,{limit:1}).length,1);
assert.throws(()=>selectIncompleteOhlcCandidates(queue,{limit:0}),/Invalid OHLC probe limits/);
const market={mic:'XLON',currency:'GBX'};
const listings=[{mic:'XLON',isin:item.isin,symbol:'TEST',currency:'GBX'}];
const sources={status:'APPROVED',historySources:[{role:'PRIMARY',provider:'good'},{role:'FALLBACK',provider:'backup'},{role:'CANDIDATE_PAID',provider:'unapproved'}]};
const calls=[];
const registry={get:id=>id==='good'||id==='backup'?{id}:null,async fetchDaily(i,range,primary,opts){calls.push({i,range,primary,opts});return {provider:{id:'good'},result:{bars:[{date:'2026-10-22',open:100,high:110,low:90,close:105,volume:20}],providerMeta:{currency:'GBX'}}};}};
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
assert.deepEqual(res.candidateBar,{date:'2026-10-22',open:100,high:110,low:90,close:105,volume:20});
assert.equal(res.currencyVerified,true);
const gbpence={...registry,async fetchDaily(){return {provider:{id:'good'},result:{bars:[{date:'2026-10-22',open:100,high:110,low:90,close:105,volume:20}],providerMeta:{currency:'GBp'}}};}};
assert.equal((await probeIncompleteOhlcCandidate(item,{registry:gbpence,sources,market,listings})).status,'COMPLETE_BAR_CANDIDATE_REQUIRES_CORRECTION_REVIEW','GBp and GBX are both pence');
const wrongCurrency={...registry,async fetchDaily(){return {provider:{id:'good'},result:{bars:[{date:'2026-10-22',open:100,high:110,low:90,close:105,volume:20}],providerMeta:{currency:'GBP'}}};}};
assert.equal((await probeIncompleteOhlcCandidate(item,{registry:wrongCurrency,sources,market,listings})).status,'SOURCE_CURRENCY_MISMATCH_REQUIRES_REVIEW','GBP pounds must never be treated as GBX pence');
const missingCurrency={...registry,async fetchDaily(){return {provider:{id:'good'},result:{bars:[{date:'2026-10-22',open:100,high:110,low:90,close:105,volume:20}],providerMeta:{}}};}};
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
 return {provider:{id:'good'},result:{bars:[{date:'2026-10-22',open:10,high:12,low:9,close:11,volume:20}],providerMeta:{currency:'EUR'}}};
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
const goodCandle={date:'2026-10-22',open:100,high:110,low:90,close:105,volume:20};
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
  assert.throws(()=>opts.acceptResult({bars:[partial]}),/Source exact-date OHLC incomplete or inconsistent/,'Provider acceptance must distinguish invalid exact-date HIGH/LOW');
  return {provider:{id:'good'},result:{bars:[partial],providerMeta:{currency:'GBX'}}};
 }};
 const probe=await probeIncompleteOhlcCandidate(item,{registry:partialRegistry,sources,market,listings});
 assert.equal(probe.status,'NO_COMPLETE_APPROVED_SOURCE_BAR');
 assert.equal(probe.candidateBar,undefined,'Never publish a partial bar as correction evidence');
}
console.log('Source evidence rejects missing/invalid HIGH/LOW, inconsistent OHLC and numeric-string candles PASS');


// Actual stored-bar snapshot must survive into source evidence without
// changing production data; difference magnitudes guide later manual review.
const storedSnapshot={open:100,high:104,low:95,close:105};
const sourceSnapshot={date:'2026-10-22',open:100,high:110,low:90,close:105};
const diff=compareStoredAndSourceOhlc(storedSnapshot,sourceSnapshot);
assert.equal(diff.readOnly,true);
assert.equal(diff.comparableFields,4);
assert.equal(diff.fields.open.absoluteDifference,0);
assert.equal(diff.fields.high.absoluteDifference,6);
assert.equal(diff.fields.low.absoluteDifference,5);
assert.ok(diff.maxRelativeDiffBps>500);
assert.equal(compareStoredAndSourceOhlc(null,sourceSnapshot),null);
assert.equal(compareStoredAndSourceOhlc(storedSnapshot,{...sourceSnapshot,high:null}),null);
// The read-only difference report must use the SAME strict parser as stored
// OHLC severity. JavaScript Number() would misclassify coercible values as
// real historical prices and publish misleading source-vs-storage magnitudes.
for(const invalid of [true,[100],{valueOf:()=>100},'0x64',' ']){
 const comparison=compareStoredAndSourceOhlc({...storedSnapshot,open:invalid},sourceSnapshot);
 assert.equal(comparison.comparableFields,3,'Coercible non-price evidence must not be compared');
 assert.equal(comparison.fields.open.relativeDifferenceBps,null);
 assert.equal(classifyOhlcDifferenceMagnitude(comparison),'NOT_FULLY_COMPARABLE');
}
const decimalLegacyComparison=compareStoredAndSourceOhlc({...storedSnapshot,open:'100.0'},sourceSnapshot);
assert.equal(decimalLegacyComparison.comparableFields,4,'Legacy decimal strings are valid price evidence');
assert.equal(decimalLegacyComparison.fields.open.absoluteDifference,0);
const missingField=compareStoredAndSourceOhlc({...storedSnapshot,low:null},sourceSnapshot);
assert.equal(missingField.comparableFields,3);
assert.equal(missingField.fields.low.absoluteDifference,null);
const compared=await probeIncompleteOhlcCandidate({...item,storedOhlc:storedSnapshot},{registry,sources,market,listings});
assert.equal(compared.status,'COMPLETE_BAR_CANDIDATE_REQUIRES_CORRECTION_REVIEW');
assert.deepEqual(compared.storedOhlc,storedSnapshot);
assert.equal(compared.sourceVsStored.fields.high.absoluteDifference,6);
assert.equal(compared.storagePolicy,'APPEND_ONLY_EXISTING_BAR_UNCHANGED');
console.log('Read-only stored-versus-source OHLC magnitude evidence and null-safe comparisons PASS');

assert.equal(classifyOhlcDifferenceMagnitude(null),'NOT_FULLY_COMPARABLE');
assert.equal(classifyOhlcDifferenceMagnitude({maxRelativeDiffBps:0.5,comparableFields:4}),'UNDER_1_BASIS_POINT');
assert.equal(classifyOhlcDifferenceMagnitude({maxRelativeDiffBps:1,comparableFields:4}),'FROM_1_TO_100_BASIS_POINTS');
assert.equal(classifyOhlcDifferenceMagnitude({maxRelativeDiffBps:100,comparableFields:4}),'AT_LEAST_100_BASIS_POINTS');
assert.equal(classifyOhlcDifferenceMagnitude(diff),'AT_LEAST_100_BASIS_POINTS');
assert.equal(classifyOhlcDifferenceMagnitude(missingField),'NOT_FULLY_COMPARABLE');
const sourceProbeScript=await (await import('node:fs/promises')).readFile('scripts/cloudflare/europe-incomplete-ohlc-source-probe.mjs','utf8');
assert.match(sourceProbeScript,/sourceVsStoredMagnitude/);
assert.match(sourceProbeScript,/classifyOhlcDifferenceMagnitude/);
console.log('Read-only OHLC source-vs-stored difference buckets and probe reporting PASS');


// Historical/last-bar overlap must preserve the stored OHLC snapshot, rather
// than silently losing source-versus-storage comparison evidence.
const duplicateLatest={...item,isin:'GB0000000301',lastStoredDate:'2026-10-22',ohlcDefects:[]};
const duplicateHistory={...duplicateLatest,evidenceScope:'RECENT_STORED_HISTORY',ohlcDefects:['HIGH_BELOW_CLOSE'],storedOhlc:{open:100,high:103,low:90,close:105}};
const overlap=selectIncompleteOhlcCandidates({markets:[{mic:'XLON',instruments:[duplicateLatest],recentOhlcDebt:[duplicateHistory]}]},{limit:4,perMarket:4});
assert.equal(overlap.length,1,'A defective date may consume only one probe slot');
assert.deepEqual(overlap[0].storedOhlc,duplicateHistory.storedOhlc,'Keep historical stored OHLC evidence for duplicate latest dates');
assert.deepEqual(overlap[0].ohlcDefects,['HIGH_BELOW_CLOSE']);
assert.equal(overlap[0].evidenceScope,'LATEST_AUDIT_BAR');
assert.equal(duplicateLatest.storedOhlc,undefined,'Never mutate the input audit');
const overlappingProbe=await probeIncompleteOhlcCandidate(overlap[0],{registry,sources,market,listings:[{...listings[0],isin:duplicateLatest.isin}]});
assert.equal(overlappingProbe.status,'COMPLETE_BAR_CANDIDATE_REQUIRES_CORRECTION_REVIEW');
assert.equal(overlappingProbe.sourceVsStored.comparableFields,4);

// Contradictory snapshots for the same ISIN/MIC/day must not be silently chosen.
const contradictory=selectIncompleteOhlcCandidates({markets:[{mic:'XLON',instruments:[{...duplicateLatest,storedOhlc:{open:100,high:102,low:90,close:105}}],recentOhlcDebt:[duplicateHistory]}]},{limit:2});
assert.equal(contradictory[0].storedEvidenceConflict,true);
const conflictingProbe=await probeIncompleteOhlcCandidate(contradictory[0],{registry,sources,market,listings:[{...listings[0],isin:duplicateLatest.isin}]});
assert.equal(conflictingProbe.status,'CONFLICTING_STORED_OHLC_EVIDENCE');

// The historical stored-bar audit and the source probe must use the same
// canonical fingerprint. Invalid boolean and string values are NOT equal;
// equivalent positive decimal strings and numbers ARE equal.
const typedStoredConflict=selectIncompleteOhlcCandidates({markets:[{mic:'XLON',
 instruments:[{...duplicateLatest,storedOhlc:{open:true,high:102,low:90,close:105}}],
 recentOhlcDebt:[{...duplicateHistory,storedOhlc:{open:'true',high:102,low:90,close:105}}]
}]},{limit:2});
assert.equal(typedStoredConflict[0].storedEvidenceConflict,true,'Boolean true and string true must not merge');
assert.equal((await probeIncompleteOhlcCandidate(typedStoredConflict[0],{registry,sources,market,listings})).status,
 'CONFLICTING_STORED_OHLC_EVIDENCE','Conflicting stored provenance must not reach an approved provider');
const equivalentStored=selectIncompleteOhlcCandidates({markets:[{mic:'XLON',
 instruments:[{...duplicateLatest,storedOhlc:{open:100,high:102,low:90,close:105}}],
 recentOhlcDebt:[{...duplicateHistory,storedOhlc:{open:'100.00',high:'102',low:'90.0',close:'105e0'}}]
}]},{limit:2});
assert.equal(equivalentStored[0].storedEvidenceConflict,undefined,'Equivalent decimal legacy prices are not contradictory');

// A conflicting symbol for the same exchange/ISIN/date is an identity
// disagreement, not a reason to silently prefer the first audit scope.
const auditSymbolConflict=selectIncompleteOhlcCandidates({markets:[{mic:'XLON',
 instruments:[duplicateLatest],
 recentOhlcDebt:[{...duplicateHistory,symbol:'DIFFERENT'}]
}]},{limit:2});
assert.equal(auditSymbolConflict[0].auditIdentityConflict,true);
assert.equal((await probeIncompleteOhlcCandidate(auditSymbolConflict[0],{registry,sources,market,listings})).status,
 'CONFLICTING_AUDIT_INSTRUMENT_IDENTITY');
const caseEquivalent=selectIncompleteOhlcCandidates({markets:[{mic:'XLON',
 instruments:[duplicateLatest],
 recentOhlcDebt:[{...duplicateHistory,symbol:'test'}]
}]},{limit:2});
assert.equal(caseEquivalent[0].auditIdentityConflict,undefined,'Case-only symbol formatting must not trigger a false identity conflict');
const recoveredSymbol=selectIncompleteOhlcCandidates({markets:[{mic:'XLON',
 instruments:[{...duplicateLatest,symbol:undefined}],
 recentOhlcDebt:[duplicateHistory]
}]},{limit:2});
assert.equal(recoveredSymbol[0].symbol,'TEST','Preserve the one available audit symbol without guessing a mapping');
console.log('Cross-scope canonical stored OHLC and instrument identity quarantine PASS');


// Rotate through both historical debt and latest gaps even if the latter is huge.
const mixedLatest=Array.from({length:70},(_,i)=>({...item,isin:'GB'+String(i).padStart(10,'0')}));
const mixedHistory=Array.from({length:70},(_,i)=>({...item,isin:'GH'+String(i).padStart(10,'0'),evidenceScope:'RECENT_STORED_HISTORY',ohlcDefects:['INVALID_HIGH']}));
const mixed=selectIncompleteOhlcCandidates({markets:[{mic:'XLON',instruments:mixedLatest,recentOhlcDebt:mixedHistory}]},{limit:32,perMarket:32,rotation:0});
assert.equal(mixed.length,32);
assert.equal(mixed.filter(x=>x.evidenceScope==='RECENT_STORED_HISTORY').length,16,'Historic candles must be sampled in every batch');
assert.equal(mixed.filter(x=>x.evidenceScope==='LATEST_AUDIT_BAR').length,16);
assert.equal(selectIncompleteOhlcCandidates({markets:[{mic:'XLON',instruments:[{...item,lastStoredDate:'2026-02-30'}],recentOhlcDebt:[]}]},{limit:2}).length,0,'Impossible calendar dates cannot enter source probe');
assert.equal((await probeIncompleteOhlcCandidate({...item,lastStoredDate:'2026-02-30'},{registry,sources,market,listings})).status,'NOT_AN_INCOMPLETE_STORED_CANDLE');
console.log('Latest/history fair sampling, merged immutable OHLC evidence, conflicting snapshots and real dates PASS');

// CI exercises intrinsic stored-candle severity separately from source-vs-stored differences.
await import('./test-europe-stored-ohlc-severity.mjs');


// Real London debt is date-dense for some ISINs: select distinct securities
// first instead of probing a single illiquid ticker on many adjacent dates.
const clustered={markets:[{mic:'XLON',recentOhlcDebt:['GB0000000101','GB0000000102','GB0000000103','GB0000000104'].flatMap((isin,index)=>
 Array.from({length:8},(_,day)=>({...item,isin,ohlcDefects:['HIGH_BELOW_CLOSE'],lastStoredDate:'2026-10-'+String(day+1).padStart(2,'0'),evidenceScope:'RECENT_STORED_HISTORY'})))}]};
for(const rotation of [0,1,2,3]){
 const batch=selectIncompleteOhlcCandidates(clustered,{limit:4,perMarket:4,rotation});
 assert.equal(new Set(batch.map(row=>row.isin)).size,4,'One date per ISIN before another date from the same ISIN');
 assert.equal(batch.length,4);
}
assert.equal(clustered.markets[0].recentOhlcDebt[0].evidenceScope,'RECENT_STORED_HISTORY','Selection never mutates the queue');
const coverage=summarizeOhlcProbeCoverage([
 {mic:'XLON',isin:'GB1',status:'NO_COMPLETE_APPROVED_SOURCE_BAR',failureCategory:'NO_NEW_BARS_IN_RANGE'},
 {mic:'XLON',isin:'GB1',status:'NO_COMPLETE_APPROVED_SOURCE_BAR',failureCategory:'NO_NEW_BARS_IN_RANGE'},
 {mic:'XLON',isin:'GB2',status:'COMPLETE_BAR_CANDIDATE_REQUIRES_CORRECTION_REVIEW'},
 {mic:'XSWX',isin:'CH1',status:'NO_COMPLETE_APPROVED_SOURCE_BAR',failureCategory:'ISIN_SEARCH_UNRESOLVED'}
]);
assert.equal(coverage.readOnly,true);
assert.equal(coverage.uniqueInstruments,3);
assert.equal(coverage.probedDates,4);
assert.equal(coverage.repeatedInstrumentDates,1);
assert.deepEqual(coverage.byMarket.XLON,{probes:3,uniqueInstruments:2,repeatedInstrumentDates:1,failuresByCategory:{NO_NEW_BARS_IN_RANGE:2}});
assert.equal(coverage.byMarket.XSWX.failuresByCategory.ISIN_SEARCH_UNRESOLVED,1);
console.log('Historical probe distinct-ISIN coverage, market failure evidence and rotation PASS');


// Rotation must not abandon the smaller latest-bar scope when thousands of
// historical dates exist; distinct-ISIN sampling and scope balance coexist.
const unbalanced={markets:[{mic:'XLON',
 instruments:Array.from({length:45},(_,i)=>({...item,isin:'GB'+String(i).padStart(10,'0')})),
 recentOhlcDebt:Array.from({length:600},(_,i)=>({...item,isin:'GH'+String(Math.floor(i/6)).padStart(10,'0'),lastStoredDate:'2026-10-'+String(i%6+1).padStart(2,'0'),evidenceScope:'RECENT_STORED_HISTORY'}))
}]};
for(const rotation of [0,1,2,10,20,57,100]){
 const batch=selectIncompleteOhlcCandidates(unbalanced,{limit:32,perMarket:32,rotation});
 const latestCount=batch.filter(x=>x.evidenceScope==='LATEST_AUDIT_BAR').length;
 const historicalCount=batch.filter(x=>x.evidenceScope==='RECENT_STORED_HISTORY').length;
 assert.ok(latestCount>=12&&historicalCount>=12,'Both scopes must be represented despite historical backlog, rotation '+rotation);
 assert.equal(new Set(batch.map(x=>x.isin)).size,32,'Different ISIN before repeat dates, rotation '+rotation);
}
console.log('Independent scope rotation prevents historical/latest starvation while preserving ISIN diversity PASS');


// Missing exact date and inconsistent exact-date source candles are different
// root causes, and both must let the registry try the next approved provider.
const exactDatePredicateRegistry={...registry,async fetchDaily(i,range,primary,opts){
 assert.throws(()=>opts.acceptResult({bars:[{...goodCandle,date:'2026-10-21'}]}),/Source has no exact-date daily bar/);
 assert.throws(()=>opts.acceptResult({bars:[{...goodCandle,high:90}]}),/Source exact-date OHLC incomplete or inconsistent/);
 assert.equal(opts.acceptResult({bars:[goodCandle]}),true);
 return {provider:{id:'good'},result:{bars:[goodCandle],providerMeta:{currency:'GBX'}}};
}};
assert.equal((await probeIncompleteOhlcCandidate(item,{registry:exactDatePredicateRegistry,sources,market,listings})).status,'COMPLETE_BAR_CANDIDATE_REQUIRES_CORRECTION_REVIEW');
console.log('Exact-date source absence and inconsistent source OHLC are separate fail-closed provider diagnoses PASS');

// Exact-date diagnostics must identify missing HIGH/LOW and price-range defects
// without inventing OHLC or misclassifying absent dates as invalid source bars.
const invalidExact={date:'2026-10-22',open:100,high:104,low:106,close:105};
const sourceQuality=describeExactDateSourceBars([invalidExact,{...invalidExact,date:'2026-10-21'}],'2026-10-22');
assert.equal(sourceQuality.exactDateBars,1);
assert.equal(sourceQuality.completeBars,0);
assert.equal(sourceQuality.invalidBars,1);
assert.equal(sourceQuality.defects.HIGH_BELOW_CLOSE,1);
assert.equal(sourceQuality.defects.LOW_ABOVE_OPEN,1);
assert.equal(sourceQuality.defects.LOW_ABOVE_CLOSE,1);
assert.equal(sourceQuality.defects.HIGH_BELOW_LOW,1);
assert.deepEqual(describeExactDateSourceBars([],'2026-10-22').defects,{NO_EXACT_DATE_BAR:1});

const sameDayA={date:'2026-10-22',open:100,high:110,low:90,close:105,volume:20};
const sameDayB={...sameDayA,close:106};
const conflict=describeExactDateSourceBars([sameDayA,sameDayB],'2026-10-22');
assert.equal(conflict.completeBars,2,'Both source bars can be individually valid');
assert.equal(conflict.invalidBars,0,'A conflicting pair is not an invalid individual candle');
assert.equal(conflict.conflictingCompleteBars,true,'Two complete but contradictory same-day bars must be disclosed');
assert.equal(describeExactDateSourceBars([sameDayA,{...sameDayA}],'2026-10-22').conflictingCompleteBars,false,'Identical duplicate bars are not contradictory');
const conflictRegistry={...registry,async fetchDaily(i,range,primary,opts){
 assert.throws(()=>opts.acceptResult({bars:[sameDayA,sameDayB]},{id:'yahoo-chart'}),/conflicting complete duplicate bars/);
 throw Error('Alle providers faalden: yahoo-chart: Source exact-date OHLC has conflicting complete duplicate bars');
}};
const conflictingEvidence=await probeIncompleteOhlcCandidate(item,{registry:conflictRegistry,sources,market,listings});
assert.equal(conflictingEvidence.status,'NO_COMPLETE_APPROVED_SOURCE_BAR','Contradictory source candles cannot be promoted');
assert.equal(conflictingEvidence.candidateBar,undefined);
assert.equal(conflictingEvidence.sourceBarObservations[0].conflictingCompleteBars,true);
const conflictSummary=summarizeOhlcSourceBarDiagnostics([conflictingEvidence]);
assert.equal(conflictSummary.conflictingSourceObservations,1);
assert.equal(conflictSummary.byMarket.XLON.conflictingSourceObservations,1);

const fallbackAfterConflict={...registry,async fetchDaily(i,range,primary,opts){
 assert.deepEqual(opts.allowedProviderIds,['good','backup']);
 assert.throws(()=>opts.acceptResult({bars:[sameDayA,sameDayB]},{id:'good'}),/conflicting complete duplicate bars/);
 assert.equal(opts.acceptResult({bars:[sameDayA]},{id:'backup'}),true,'An approved independent fallback may supply one complete date');
 return {provider:{id:'backup'},result:{bars:[sameDayA],providerMeta:{currency:'GBX'}}};
}};
const fallbackEvidence=await probeIncompleteOhlcCandidate(item,{registry:fallbackAfterConflict,sources,market,listings});
assert.equal(fallbackEvidence.status,'COMPLETE_BAR_CANDIDATE_REQUIRES_CORRECTION_REVIEW');
assert.equal(fallbackEvidence.provider,'backup');
assert.equal(fallbackEvidence.sourceBarObservations[0].conflictingCompleteBars,true);
assert.equal(fallbackEvidence.sourceBarObservations[1].conflictingCompleteBars,false);
assert.equal(fallbackEvidence.storagePolicy,'APPEND_ONLY_EXISTING_BAR_UNCHANGED');

console.log('Conflicting complete same-date source bars rejected, identical duplicates allowed, evidence remains read-only PASS');

assert.equal(describeExactDateSourceBars([{...invalidExact,high:null}],'2026-10-22').defects.INVALID_OR_MISSING_HIGH,1);
assert.equal(describeExactDateSourceBars([{...invalidExact,low:'90'}],'2026-10-22').defects.INVALID_OR_MISSING_LOW,1);
assert.equal(describeExactDateSourceBars([{...invalidExact,high:110,low:90}],'2026-10-22').completeBars,1);
const diagnosticRegistry={...registry,async fetchDaily(i,range,primary,opts){
 assert.throws(()=>opts.acceptResult({bars:[invalidExact]},{id:'yahoo-chart'}),/Source exact-date OHLC incomplete or inconsistent/);
 assert.throws(()=>opts.acceptResult({bars:[{...invalidExact,date:'2026-10-21'}]},{id:'euronext-live'}),/Source has no exact-date daily bar/);
 throw Error('Alle providers faalden voor GB0000000001: yahoo-chart: Source exact-date OHLC incomplete or inconsistent');
}};
const invalidEvidence=await probeIncompleteOhlcCandidate(item,{registry:diagnosticRegistry,sources,market,listings});
assert.equal(invalidEvidence.status,'NO_COMPLETE_APPROVED_SOURCE_BAR');
assert.equal(invalidEvidence.candidateBar,undefined);
assert.equal(invalidEvidence.sourceBarObservations.length,2);
const qualitySummary=summarizeOhlcSourceBarDiagnostics([invalidEvidence,{...invalidEvidence,mic:'XSWX',sourceBarObservations:[]}]);
assert.equal(qualitySummary.probesWithInvalidBars,1);
assert.equal(qualitySummary.invalidSourceBars,1);
assert.equal(qualitySummary.observations,2);
assert.equal(qualitySummary.byMarket.XLON.defects.HIGH_BELOW_CLOSE,1);
assert.equal(qualitySummary.byMarket.XLON.defects.NO_EXACT_DATE_BAR,1);
assert.equal(qualitySummary.byMarket.XSWX.invalidSourceBars,0);
assert.equal(qualitySummary.byProvider['yahoo-chart'].invalidSourceBars,1);
assert.equal(qualitySummary.byProvider['yahoo-chart'].sourceObservations,1);
assert.equal(qualitySummary.byProvider['euronext-live'].invalidSourceBars,0);
assert.equal(qualitySummary.byMarket.XLON.byProvider['yahoo-chart'].defects.HIGH_BELOW_CLOSE,1);
assert.equal(qualitySummary.byMarket.XLON.byProvider['euronext-live'].defects.NO_EXACT_DATE_BAR,1);
assert.equal(invalidEvidence.sourceBarObservations[0].providerId,'yahoo-chart');
assert.equal(invalidEvidence.sourceBarObservations[1].providerId,'euronext-live');
const unattributed=summarizeOhlcSourceBarDiagnostics([{mic:'XLON',sourceBarObservations:[{readOnly:true,invalidBars:1,defects:{INVALID_OR_MISSING_HIGH:1}}]}]);
assert.equal(unattributed.byProvider.UNATTRIBUTED.invalidSourceBars,1,'Missing provider identity must not be guessed');
console.log('Exact-date source OHLC defect attribution, absent date and bounded read-only market diagnostics PASS');



// Two Yahoo adapters share one upstream chart feed. Counting them as
// independent validation would overstate the evidence for London/Switzerland.
assert.equal(sourceFeedFamily('yahoo-chart'),'yahoo-chart-feed');
assert.equal(sourceFeedFamily('yahoo-isin-resolver'),'yahoo-chart-feed');
assert.equal(sourceFeedFamily('nasdaq-baltic-official'),'nasdaq-baltic-official');
assert.equal(sourceFeedFamily(null),'UNATTRIBUTED');
const correlated=summarizeOhlcSourceBarDiagnostics([{
 mic:'XLON',sourceBarObservations:[
  {readOnly:true,providerId:'yahoo-chart',invalidBars:1,defects:{HIGH_BELOW_CLOSE:1}},
  {readOnly:true,providerId:'yahoo-isin-resolver',invalidBars:1,defects:{HIGH_BELOW_CLOSE:1}},
  {readOnly:true,providerId:'independent-official',invalidBars:0,defects:{}}
 ]
}]);
assert.equal(correlated.observations,3);
assert.equal(correlated.invalidSourceBars,2);
assert.equal(correlated.correlatedProviderAttempts,1,'Two Yahoo attempts on one date are correlated, not two independent sources');
assert.equal(correlated.distinctFeedObservations,2,'Two Yahoo routes share one underlying feed, plus one official feed');
assert.equal(correlated.feedLevelInvalidBarsLowerBound,1,'Two identical Yahoo errors on one date are not two independently observed invalid bars');
assert.equal(correlated.byMarket.XLON.distinctFeedObservations,2);
assert.equal(correlated.byMarket.XLON.feedLevelInvalidBarsLowerBound,1);
const multiDate=summarizeOhlcSourceBarDiagnostics([
 {mic:'XLON',sourceBarObservations:[{readOnly:true,providerId:'yahoo-chart',invalidBars:2},{readOnly:true,providerId:'yahoo-isin-resolver',invalidBars:3}]},
 {mic:'XLON',sourceBarObservations:[{readOnly:true,providerId:'yahoo-chart',invalidBars:1}]}
]);
assert.equal(multiDate.invalidSourceBars,6,'Raw attempts are retained');
assert.equal(multiDate.distinctFeedObservations,2,'Feed observations are deduplicated only within one instrument/date probe');
assert.equal(multiDate.feedLevelInvalidBarsLowerBound,4,'Per-feed maximum per probe is a lower bound, not exact deduplication');
assert.equal(correlated.bySourceFamily['yahoo-chart-feed'].sourceObservations,2);
assert.equal(correlated.bySourceFamily['yahoo-chart-feed'].invalidSourceBars,2);
assert.equal(correlated.byMarket.XLON.bySourceFamily['yahoo-chart-feed'].defects.HIGH_BELOW_CLOSE,2);
assert.equal(correlated.bySourceFamily['independent-official'].sourceObservations,1);
assert.equal(calls[0].range.includeIncompleteBars,true,'Only read-only OHLC probe requests missing-field evidence');
console.log('Yahoo shared-source correlation and read-only missing-field range guards PASS');


// A provider may return a valid bar and an invalid bar for the same date.
// Selecting the valid duplicate silently hides contradictory raw evidence.
const mixedValid={date:'2026-10-22',open:100,high:110,low:90,close:105,volume:20};
const mixedInvalid={...mixedValid,high:99};
const mixedObservation=describeExactDateSourceBars([mixedValid,mixedInvalid],'2026-10-22');
assert.equal(mixedObservation.completeBars,1);
assert.equal(mixedObservation.invalidBars,1);
assert.equal(mixedObservation.mixedCompleteInvalidBars,true);
assert.equal(describeExactDateSourceBars([mixedValid,{...mixedValid}],'2026-10-22').mixedCompleteInvalidBars,false);
const mixedRegistry={...registry,async fetchDaily(i,range,primary,opts){
 assert.throws(()=>opts.acceptResult({bars:[mixedValid,mixedInvalid]},{id:'good'}),/mixes complete and invalid duplicate bars/);
 throw Error('Alle providers faalden: good: Source exact-date OHLC mixes complete and invalid duplicate bars');
}};
const mixedRejected=await probeIncompleteOhlcCandidate(item,{registry:mixedRegistry,sources,market,listings});
assert.equal(mixedRejected.status,'NO_COMPLETE_APPROVED_SOURCE_BAR');
assert.equal(mixedRejected.candidateBar,undefined);
assert.equal(mixedRejected.failureCategory,'SOURCE_EXACT_DATE_MIXED_BARS');
assert.equal(mixedRejected.sourceBarObservations[0].mixedCompleteInvalidBars,true);
const mixedStats=summarizeOhlcSourceBarDiagnostics([mixedRejected]);
assert.equal(mixedStats.mixedSourceObservations,1);
assert.equal(mixedStats.byMarket.XLON.mixedSourceObservations,1);
console.log('Mixed valid/invalid same-date source duplicates are rejected, classified and counted PASS');

// Missing source dates are not malformed OHLC or evidence of no trading.
// Two correlated Yahoo adapters must not be counted as independent feeds;
// a disagreement between adapters is explicitly discordant, not no-trade.
const absenceStats=summarizeOhlcSourceBarDiagnostics([
 {mic:'XLON',sourceBarObservations:[
  {...describeExactDateSourceBars([],'2026-10-22'),providerId:'yahoo-chart'},
  {...describeExactDateSourceBars([],'2026-10-22'),providerId:'yahoo-isin-resolver'}
 ]},
 {mic:'XSWX',sourceBarObservations:[
  {...describeExactDateSourceBars([],'2026-10-22'),providerId:'yahoo-chart'},
  {...describeExactDateSourceBars([mixedValid],'2026-10-22'),providerId:'yahoo-isin-resolver'}
 ]},
 {mic:'XCYS',sourceBarObservations:[
  {...describeExactDateSourceBars([mixedValid],'2026-10-22'),providerId:'independent-official'}
 ]}
]);
assert.equal(absenceStats.missingExactDateObservations,3);
assert.equal(absenceStats.probesWithMissingExactDate,2);
assert.equal(absenceStats.distinctFeedNoExactDateObservations,1);
assert.equal(absenceStats.discordantExactDateFeedObservations,1);
assert.equal(absenceStats.invalidSourceBars,0,'An absent date is not an invalid price bar');
assert.equal(absenceStats.byMarket.XLON.distinctFeedNoExactDateObservations,1);
assert.equal(absenceStats.byMarket.XSWX.discordantExactDateFeedObservations,1);
console.log('Missing exact-date observations are correlated-feed-aware and never infer no-trade PASS');


// Real provider-registry behavior: an empty exact-date response previously
// threw before the source observer, concealing NO_EXACT_DATE_BAR evidence.
const {ProviderRegistry}=await import('../history/provider-registry.mjs');
const actualEmptyRegistry=new ProviderRegistry([
 {id:'good',supports:()=>true,async fetchDaily(){return {bars:[]};}},
 {id:'backup',supports:()=>true,async fetchDaily(){return {bars:[mixedValid],providerMeta:{currency:'GBX'}};}}
]);
const actualEmptyProbe=await probeIncompleteOhlcCandidate(item,{registry:actualEmptyRegistry,sources,market,listings,timeoutMs:1000});
assert.equal(actualEmptyProbe.status,'COMPLETE_BAR_CANDIDATE_REQUIRES_CORRECTION_REVIEW');
assert.equal(actualEmptyProbe.provider,'backup');
assert.equal(actualEmptyProbe.sourceBarObservations[0].providerId,'good');
assert.equal(actualEmptyProbe.sourceBarObservations[0].exactDateBars,0);
assert.equal(actualEmptyProbe.sourceBarObservations[0].defects.NO_EXACT_DATE_BAR,1);
assert.equal(actualEmptyProbe.sourceBarObservations[1].providerId,'backup');
const actualEmptySummary=summarizeOhlcSourceBarDiagnostics([actualEmptyProbe]);
assert.equal(actualEmptySummary.missingExactDateObservations,1);
assert.equal(actualEmptySummary.distinctFeedNoExactDateObservations,1);
assert.equal(actualEmptySummary.invalidSourceBars,0);
console.log('Production registry opt-in surfaces empty exact-date source evidence while approved fallback remains review-only PASS');
