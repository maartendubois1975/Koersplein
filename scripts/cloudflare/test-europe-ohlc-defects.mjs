import assert from 'node:assert/strict';
import {describeOhlcDefects,countOhlcDefects} from './europe-ohlc-defects.mjs';
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
assert.match(queue,/READ_ONLY_VERIFICATION_REQUIRED_APPEND_ONLY_PRESERVES_EXISTING_BAR/);
assert.match(summary,/invalidOhlcByDefect/);

console.log('Stored OHLC defect classification and aggregation PASS');
