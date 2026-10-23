import assert from 'node:assert/strict';
import {evaluateEuropeShardCoverage} from './europe-shard-coverage.mjs';
import {renderEuropeReport} from './format-europe-run-report.mjs';
const plan={markets:Array.from({length:10},(_,i)=>({mic:`X${i}`,state:'COMPLETE'}))};
const expected=Array.from({length:8},(_,shard)=>plan.markets.filter((_,i)=>i%8===shard).map(m=>({mic:m.mic})));
const make=()=>expected.map((markets,shardIndex)=>({shardIndex,shardCount:8,markets:markets.map(x=>({...x}))}));
const valid=evaluateEuropeShardCoverage(plan,make(),make());
assert.equal(valid.complete,true);
assert.equal(valid.expectedMarkets,10);
assert.equal(valid.reportedAuditMarkets,10);
const partial=make();partial[0].markets.pop();
assert.equal(evaluateEuropeShardCoverage(plan,partial,make()).complete,false);
assert.equal(evaluateEuropeShardCoverage(plan,partial,make()).anomalies[0].issue,'MISSING_MARKET');
const duplicate=make();duplicate[1].markets.push({...duplicate[1].markets[0]});
assert.equal(evaluateEuropeShardCoverage(plan,make(),duplicate).complete,false);
const wrongShard=make();wrongShard[3].shardCount=7;
assert.equal(evaluateEuropeShardCoverage(plan,wrongShard,make()).complete,false);
assert.equal(evaluateEuropeShardCoverage(plan,make().slice(1),make()).complete,false);
const report={status:'INCOMPLETE',historyCompleteness:'NOT_PROVEN_BY_DAILY_AUDIT',shardsComplete:false,marketCoverage:{complete:false,anomalies:[{kind:'update',shard:0,issue:'MISSING_MARKET',mic:'X0'}]},totals:{catalog:7051,currentOpenClose:5852,verifiedNoTrades:452,missingOpenClose:747,failedImports:734},invalidOhlcByDefect:{MISSING_HIGH:110,MISSING_LOW:80},recoveryPriority:[{mic:'XLON',missingOpenClose:246,importFailures:247},{mic:'XSWX',missingOpenClose:237,importFailures:236}]};
const rendered=renderEuropeReport(report,'https://github.com/test/repo/actions/runs/123');
assert.match(rendered,/Missing open\/close \| 747/);
assert.match(rendered,/MISSING_MARKET X0/);
assert.match(rendered,/\| XLON \| 246 \| 247 \|/);
assert.match(rendered,/MISSING_HIGH \| 110/);
assert.match(rendered,/Append-only storage preserves existing records/);
assert.match(rendered,/PARTIAL RUN/,'Missing update shards must be reported separately from missing audit markets');
const auditPartial=renderEuropeReport({...report,marketCoverage:{complete:false,anomalies:[{kind:'audit',shard:0,issue:'REPORT_COUNT'}]}});
assert.match(auditPartial,/PARTIAL AUDIT/,'Missing audit shards must be clearly marked');
const withDebt=renderEuropeReport({...report,historicalOhlcDebt:{readOnly:true,datesInRecoveryQueue:3246,byMarket:[{mic:'XLON',defectiveDates:1100},{mic:'XSWX',defectiveDates:900}]}});
assert.match(withDebt,/3246.*not repaired/);
assert.match(withDebt,/XLON 1100/);
assert.ok(rendered.length<4000);
assert.match(renderEuropeReport(null),/Summary unavailable/);
console.log('Europe eight-shard market completeness and compact issue reporting PASS');

const sourceReport={...report,generatedAt:'2026-10-23T10:50:02.000Z',missingByReason:{INCOMPLETE_OR_INVALID_OHLC:195,STALE_LAST_TRADE:100,NO_HISTORY_PARTITIONS:20},sourceFailureByMarket:{XLON:{failed:30,categories:{UNRESOLVED_MARKET_SYMBOL:18,ISIN_SEARCH_UNRESOLVED:10}},XSWX:{failed:227,categories:{ISIN_SEARCH_UNRESOLVED:227}}}};
const sourceProbe={status:'COMPLETED',generatedAt:'2026-10-23T10:50:03.000Z',requested:30,counts:{COMPLETE_BAR_CANDIDATE_REQUIRES_CORRECTION_REVIEW:17,NO_EXACT_CATALOG_ISIN_MIC:5,NO_COMPLETE_APPROVED_SOURCE_BAR:8}};
const detailed=renderEuropeReport(sourceReport,'',sourceProbe);
assert.match(detailed,/INCOMPLETE_OR_INVALID_OHLC: 195/);
assert.match(detailed,/XLON: UNRESOLVED_MARKET_SYMBOL 18/);
assert.match(detailed,/Historical source check \(read-only\)/);
assert.match(detailed,/COMPLETE_BAR_CANDIDATE_REQUIRES_CORRECTION_REVIEW 17/);
assert.match(detailed,/No stored OHLC has been overwritten/);
assert.doesNotMatch(renderEuropeReport(sourceReport,'',{...sourceProbe,generatedAt:'2026-10-22T10:50:03.000Z'}),/Historical source check \(read-only\)/,'Stale evidence must not be presented as current');
console.log('Evidence-rich Europe issue reporting, source blockers and freshness guard PASS');

const severityProbe={...sourceProbe,storedOhlcViolationSeverity:{
 readOnly:true,complete:true,metric:'INTRINSIC_STORED_CANDLE_VIOLATION_NOT_SOURCE_COMPARISON',examined:3249,
 counts:{FROM_100_TO_1000_BPS:2020,AT_LEAST_1000_BPS:204},
 byMarket:[{mic:'XLON',examined:2889,atLeast100Bps:2084}]
}};
const severityReport=renderEuropeReport(sourceReport,'',severityProbe);
assert.match(severityReport,/2224\/3249/);
assert.match(severityReport,/2084\/2889/);
assert.match(severityReport,/not verified replacement prices/);
const partialSeverity=renderEuropeReport(sourceReport,'',{...severityProbe,storedOhlcViolationSeverity:{...severityProbe.storedOhlcViolationSeverity,complete:false}});
assert.match(partialSeverity,/partial or unverified/);
console.log('Europe stored-candle severity reporting is evidence-only and completeness-gated PASS');


const diverseProbe={...sourceProbe,probeCoverage:{readOnly:true,uniqueInstruments:26,probedDates:30,repeatedInstrumentDates:4,byMarket:{XLON:{probes:20,uniqueInstruments:16,repeatedInstrumentDates:4,failuresByCategory:{NO_NEW_BARS_IN_RANGE:14}}}}};
const diverseReport=renderEuropeReport(sourceReport,'',diverseProbe);
assert.match(diverseReport,/Distinct instruments sampled: \*\*26\/30\*\*/);
assert.match(diverseReport,/London source sample: 16 distinct ISIN across 20 dates/);
assert.match(diverseReport,/14 NO_NEW_BARS_IN_RANGE/);
assert.doesNotMatch(renderEuropeReport(sourceReport,'',{...diverseProbe,probeCoverage:{...diverseProbe.probeCoverage,probedDates:29}}),/Distinct instruments sampled/,'Do not claim coverage for inconsistent probe totals');
console.log('Read-only distinct-ISIN source diversity and London missing-day classification PASS');

const invalidSourceProbe={...sourceProbe,sourceBarDiagnostics:{
 readOnly:true,observations:29,invalidSourceBars:25,probesWithInvalidBars:25,
 byMarket:{XLON:{sourceObservations:29,invalidSourceBars:25,probesWithInvalidBars:25,defects:{INVALID_OR_MISSING_HIGH:18,HIGH_BELOW_CLOSE:7,NO_EXACT_DATE_BAR:3}}}
}};
const invalidSourceReport=renderEuropeReport(sourceReport,'',invalidSourceProbe);
assert.match(invalidSourceReport,/25 invalid source bars in 29 provider-result observations/);
assert.match(invalidSourceReport,/London exact-date source quality: 25 invalid bars/);
assert.match(invalidSourceReport,/INVALID_OR_MISSING_HIGH 18/);
assert.match(invalidSourceReport,/not additional stored-history defects/);
assert.doesNotMatch(renderEuropeReport(sourceReport,'',{...invalidSourceProbe,generatedAt:'2026-10-22T10:50:03.000Z'}),/London exact-date source quality/);
console.log('Source bar field-level defect reporting remains read-only and freshness-gated PASS');
