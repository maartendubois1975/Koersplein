import assert from 'node:assert/strict';
import {assessHistoricalCoverage as assess} from './europe-historical-quality-core.mjs';
import {isValidIsin} from './isin-identity-core.mjs';

const full = assess({instruments:5,usableInstruments:5,observations:100,failed:0,insufficientHistory:0});
assert.equal(full.complete, true);
for (const input of [
  {instruments:0,usableInstruments:0,observations:0},
  {instruments:5,usableInstruments:4,observations:80},
  {instruments:5,usableInstruments:4,observations:80,insufficientHistory:1},
  {instruments:5,usableInstruments:5,observations:100,failed:1},
  {instruments:5,usableInstruments:6,observations:100},
  {instruments:-1,usableInstruments:0,observations:100},
  {instruments:5,usableInstruments:5,observations:-1},
  {instruments:5,usableInstruments:5,observations:Infinity}
]) assert.equal(assess(input).complete, false, JSON.stringify(input));

for (const isin of ['LU2458332611','CH0198251305','ES0125220311','GB00B1YW4409']) {
  assert.equal(isValidIsin(isin), true, isin);
}
for (const isin of ['XICE:ALVO','XICE:AMRQ',null,'','ES0125220312','LU2458332612','lu2458332611','WIG20']) {
  assert.equal(isValidIsin(isin), false, String(isin));
}
console.log('EUROPE_HISTORICAL_COVERAGE_AND_ISIN_GATE_TEST_PASS');
