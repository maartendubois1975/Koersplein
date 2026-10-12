import assert from 'node:assert/strict';
import {assessHistoricalCoverage as assess} from './europe-historical-quality-core.mjs';
const full=assess({instruments:5,usableInstruments:5,observations:100,failed:0,insufficientHistory:0});
assert.equal(full.complete,true);
for(const input of [
 {instruments:0,usableInstruments:0,observations:0},
 {instruments:5,usableInstruments:4,observations:80},
 {instruments:5,usableInstruments:4,observations:80,insufficientHistory:1},
 {instruments:5,usableInstruments:5,observations:100,failed:1}
])assert.equal(assess(input).complete,false);
console.log('EUROPE_HISTORICAL_COVERAGE_GATE_TEST_PASS');
