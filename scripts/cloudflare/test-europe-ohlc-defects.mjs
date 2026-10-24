import assert from 'node:assert/strict';
import {describeOhlcDefects,countOhlcDefects,recentOhlcDebt,inspectStoredOhlcDateConflicts} from './europe-ohlc-defects.mjs';
const valid={date:'2026-10-22',open:10,high:12,low:9,close:11};
assert.deepEqual(describeOhlcDefects(valid),[]);
assert.deepEqual(describeOhlcDefects({...valid,high:null}),['MISSING_HIGH']);
assert.deepEqual(describeOhlcDefects({...valid,low:undefined}),['MISSING_LOW']);
assert.deepEqual(describeOhlcDefects({...valid,high:10.5}),['HIGH_BELOW_CLOSE']);
assert.deepEqual(describeOhlcDefects({...valid,low:10.5}),['LOW_ABOVE_OPEN']);
assert.deepEqual(describeOhlcDefects({...valid,high:8,low:13}),['HIGH_BELOW_LOW','HIGH_BELOW_OPEN','HIGH_BELOW_CLOSE','LOW_ABOVE_OPEN','LOW_ABOVE_CLOSE']);
assert.deepEqual(describeOhlcDefects({...valid,close:0}),['INVALID_CLOSE']);
assert.deepEqual(describeOhlcDefects({...valid,date:'2026-02-30'}),['INVALID_DATE']);
assert.deepEqual(describeOhlcDefects(null),['BAR_MISSING']);
assert.deepEqual(countOhlcDefects([{reason:'INCOMPLETE_OR_INVALID_OHLC',ohlcDefects:['MISSING_HIGH','MISSING_LOW']},{reason:'INCOMPLETE_OR_INVALID_OHLC',ohlcDefects:['MISSING_HIGH']},{reason:'STALE_LAST_TRADE',ohlcDefects:['MISSING_HIGH']},{reason:'INCOMPLETE_OR_INVALID_OHLC'}]),{MISSING_HIGH:2,MISSING_LOW:1,UNCLASSIFIED_INCOMPLETE_OHLC:1});

import fs from 'node:fs/promises';
const audit=await fs.readFile('scripts/cloudflare/audit-daily-open-close.mjs','utf8');
const queue=await fs.readFile('scripts/cloudflare/europe-recovery-queue.mjs','utf8');
const summary=await fs.readFile('scripts/cloudflare/summarize-europe-run.mjs','utf8');
assert.match(audit,/describeOhlcDefects/);
assert.match(audit,/invalidOhlcByDefect:countOhlcDefects/);
assert.match(audit,/recentOhlcDebt\(bars,cutoff,30\)/);
assert.match(audit,/selectEuropeAuditHistoryPeriods/,'Audit must fetch all yearly partitions intersecting the 30-day window');
assert.match(audit,/inspectStoredOhlcDateConflicts/);
assert.match(audit,/recentInvalidOhlcDays/);
assert.match(audit,/recentOhlcDebtCandidates/,'All recent stored defect dates must be exported, not only 12 examples');
assert.match(audit,/storedOhlc/,'Audit must export exact stored OHLC snapshots for source comparison');
assert.match(queue,/storedOhlc:row\.storedOhlc/,'Historical debt queue must preserve original stored prices');
assert.match(queue,/storedOhlc:missing\.reason/,'Current defective candles must preserve original stored prices');
assert.match(queue,/recentOhlcDebtCount/,'Recovery queue must expose recent historical OHLC debt');
assert.match(queue,/READ_ONLY_VERIFICATION_REQUIRED_APPEND_ONLY_PRESERVES_EXISTING_BAR/);
assert.match(summary,/invalidOhlcByDefect/);
assert.match(summary,/recentInvalidOhlcDays/);

const recent=recentOhlcDebt([{...valid,date:'2026-10-01',high:null},{...valid,date:'2026-10-20',low:null},{...valid,date:'2026-10-20'},{...valid,date:'2026-10-21',high:null},{...valid,date:'2026-10-22'}],'2026-10-22',10);
assert.deepEqual(recent.invalidDates,[{date:'2026-10-21',defects:['MISSING_HIGH']}]);
assert.equal(recent.windowStart,'2026-10-13');
assert.deepEqual(recentOhlcDebt([{...valid,date:'2026-10-23',high:null}],'2026-10-22').invalidDates,[],'Do not count intraday bars as closed-session debt');
assert.throws(()=>recentOhlcDebt([], '2026-02-30'),/Invalid closed-session/);
console.log('Stored OHLC defect classification and aggregation PASS');

\n// A 30-day history audit crossing 1 January must retain prior-year defects.
const yearBars=[{...valid,date:'2025-12-20',high:null},{...valid,date:'2026-01-04',low:null}];
assert.equal(recentOhlcDebt(yearBars,'2026-01-09',30).invalidDates.length,2);
const conflictingRows=[
 {...valid,date:'2026-01-04',close:11},
 {...valid,date:'2026-01-04',close:10},
 {...valid,date:'2026-01-05'},
 {...valid,date:'2026-01-05',high:null},
 {...valid,date:'2026-01-06'},
 {...valid,date:'2026-01-06'},
 {...valid,date:'2025-11-01',close:12}
];
const duplicateEvidence=inspectStoredOhlcDateConflicts(conflictingRows,'2026-01-09',30);
assert.equal(duplicateEvidence.readOnly,true);
assert.equal(duplicateEvidence.count,2);
assert.deepEqual(duplicateEvidence.dates.map(x=>[x.date,x.category]),[
 ['2026-01-04','CONFLICTING_COMPLETE_STORED_OHLC'],
 ['2026-01-05','MIXED_COMPLETE_INVALID_STORED_OHLC']
]);
assert.equal(duplicateEvidence.dates[0].distinctOhlc,2);
assert.equal(duplicateEvidence.dates[0].rows,2);
assert.equal(recentOhlcDebt(conflictingRows,'2026-01-09',30).invalidDates.length,0,'Legacy defect metric remains separate from duplicate provenance');
assert.equal(inspectStoredOhlcDateConflicts([{...valid,date:'2026-01-04',open:'10'},{...valid,date:'2026-01-04',open:10}],'2026-01-09').count,0,'Equivalent numeric OHLC values are not conflicts');
assert.throws(()=>inspectStoredOhlcDateConflicts([], '2026-02-30'),/Invalid stored OHLC conflict window/);
console.log('Cross-year debt and immutable same-date stored OHLC conflict diagnostics PASS');
