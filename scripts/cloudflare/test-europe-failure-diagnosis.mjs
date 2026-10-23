import assert from 'node:assert/strict';
import {providerAttempts,classifyEuropeFailure,diagnoseEuropeReports} from './europe-failure-diagnosis.mjs';

const swiss='Alle providers faalden voor AT0000KTMI02: yahoo-chart: Yahoo HTTP 404 voor 41860974.SW; yahoo-isin-resolver: Geen Yahoo ISIN-resolutie voor AT0000KTMI02';
const london='Alle providers faalden voor GB00BMXTZ463: yahoo-chart: Provider returned no daily bars; yahoo-isin-resolver: Geen Yahoo ISIN-resolutie voor GB00BMXTZ463';
const stale='Alle providers faalden voor CH0006326851: yahoo-chart: Provider returned no usable bars in requested range; yahoo-isin-resolver: Provider returned no usable bars in requested range';
assert.equal(classifyEuropeFailure(swiss),'UNRESOLVED_MARKET_SYMBOL');
assert.equal(classifyEuropeFailure(london),'ISIN_SEARCH_UNRESOLVED');
assert.equal(classifyEuropeFailure(stale),'NO_NEW_BARS_IN_RANGE');
assert.equal(classifyEuropeFailure('yahoo-chart: Yahoo HTTP 404 voor BAD.SW'),'DIRECT_SYMBOL_NOT_FOUND');
assert.equal(classifyEuropeFailure('HTTP 429 rate limit'),'RATE_LIMIT');
assert.equal(classifyEuropeFailure('Providerbeurs wijkt af'),'SYMBOL_IDENTITY_MISMATCH');
assert.deepEqual(providerAttempts(swiss).map(x=>x.provider),['yahoo-chart','yahoo-isin-resolver']);
const updates=[{markets:[
 {mic:'XSWX',failed:[{isin:'AT0000KTMI02',symbol:'41860974',error:swiss},{isin:'CH0006326851',symbol:'CCAP',error:stale}]},
 {mic:'XLON',failed:[{isin:'GB00BMXTZ463',symbol:'ZAIM',error:london}]}
]}];
const audits=[{markets:[{mic:'XSWX',missingOpenClose:237,missingReasons:{MISSING_INVALID_OR_STALE_OHLC:220}},{mic:'XLON',missingOpenClose:247}]}];
const diagnosis=diagnoseEuropeReports(updates,audits);
assert.equal(diagnosis.totals.failed,3);
assert.equal(diagnosis.totals.numericSymbolFailures,1);
assert.equal(diagnosis.markets[0].mic,'XLON');
assert.equal(diagnosis.markets[1].mic,'XSWX');
assert.equal(diagnosis.markets[1].categories.UNRESOLVED_MARKET_SYMBOL,1);
assert.equal(diagnosis.markets[1].categories.NO_NEW_BARS_IN_RANGE,1);
assert.equal(diagnosis.markets[1].providerFailures['yahoo-chart'],2);
assert.equal(diagnosis.markets[1].numericSymbolFailures,1);
console.log('Europe failure evidence parser and market diagnosis: PASS');
