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

// Regression from production 2026-10-23: 403/401 in ISINs were wrongly
// classified as authorization errors despite the provider returning 404/empty.
assert.equal(classifyEuropeFailure('Alle providers faalden voor NL0011794037: yahoo-chart: Yahoo HTTP 404 voor AD.BR'),'DIRECT_SYMBOL_NOT_FOUND');
assert.equal(classifyEuropeFailure('Alle providers faalden voor FR001401AU31: yahoo-chart: Provider returned no usable bars in requested range; euronext-live: Geen verhandelde Euronext koershistorie voor FR001401AU31-ALXP'),'NO_NEW_BARS_IN_RANGE');
assert.equal(classifyEuropeFailure('Alle providers faalden voor GB0042900001: yahoo-chart: Provider returned no daily bars'),'PROVIDER_RETURNED_NO_BARS');
assert.equal(classifyEuropeFailure('Alle providers faalden voor GB0040300001: yahoo-chart: Yahoo HTTP 403 voor TEST.L'),'AUTH_OR_ACCESS');
assert.equal(classifyEuropeFailure('Alle providers faalden voor GB0042900001: yahoo-chart: Yahoo HTTP 429 voor TEST.L'),'RATE_LIMIT');
assert.equal(classifyEuropeFailure('Alle providers faalden voor SI0031103805: yahoo-isin-resolver: Geen Yahoo-beursregel voor XLJU'),'NO_SUPPORTED_PROVIDER_FOR_MARKET');
assert.equal(classifyEuropeFailure('Alle providers faalden voor EE3100126368: nasdaq-baltic-official: Geen Nasdaq Baltic koershistorie voor EE3100126368; yahoo-isin-resolver: Geen Yahoo-beursregel voor XLIT'),'OFFICIAL_SOURCE_NO_USABLE_BARS','Do not misclassify a real official source attempt as unsupported');

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


assert.equal(classifyEuropeFailure('Alle providers faalden voor GB0000000001: yahoo-chart: Source has no exact-date daily bar; yahoo-isin-resolver: Source has no exact-date daily bar'),'SOURCE_EXACT_DATE_NO_BAR');
assert.equal(classifyEuropeFailure('Alle providers faalden voor GB0000000001: yahoo-chart: Source has no exact-date daily bar; yahoo-isin-resolver: Source exact-date OHLC incomplete or inconsistent'),'SOURCE_EXACT_DATE_OHLC_INVALID');
assert.equal(classifyEuropeFailure('Alle providers faalden voor GB0000000001: yahoo-chart: Source exact-date OHLC incomplete or inconsistent; yahoo-isin-resolver: Provider returned no daily bars'),'SOURCE_EXACT_DATE_OHLC_INVALID');
console.log('Source exact-date missing versus invalid OHLC error classification PASS');


assert.equal(classifyEuropeFailure('Alle providers faalden voor GB0000000001: yahoo-chart: Source exact-date OHLC mixes complete and invalid duplicate bars'),'SOURCE_EXACT_DATE_MIXED_BARS');
assert.equal(classifyEuropeFailure('Alle providers faalden voor GB0000000001: yahoo-chart: Source exact-date OHLC mixes complete and invalid duplicate bars; yahoo-isin-resolver: Source has no exact-date daily bar'),'SOURCE_EXACT_DATE_MIXED_BARS');
console.log('Mixed-validity duplicate OHLC evidence is separately classified PASS');

assert.equal(classifyEuropeFailure('Alle providers faalden voor GB0000000001: yahoo-chart: Source duplicate-date OHLC conflict'),'SOURCE_DUPLICATE_DATE_OHLC_CONFLICT');
assert.equal(classifyEuropeFailure('Alle providers faalden voor CH0000000001: yahoo-chart: Source duplicate-date OHLC conflict; yahoo-isin-resolver: Provider returned no daily bars'),'SOURCE_DUPLICATE_DATE_OHLC_CONFLICT');
console.log('Conflicting same-day production source OHLC is quarantined and classified PASS');

// New production identity gates must remain diagnosable by MIC, not collapse
// into PROVIDER_OTHER or be mistaken for a missing trading-day bar.
assert.equal(classifyEuropeFailure('Alle providers faalden voor GB0000000001: yahoo-chart: Providervaluta wijkt af voor GB0000000001: verwacht GBX, ontvangen GBP'),'PROVIDER_CURRENCY_MISMATCH');
assert.equal(classifyEuropeFailure('Alle providers faalden voor FR0000000001: yahoo-chart: Providerbeurs ontbreekt voor FR0000000001: verwacht XPAR'),'PROVIDER_VENUE_UNVERIFIED');
assert.equal(classifyEuropeFailure('Alle providers faalden voor FR0000000001: yahoo-chart: Providerbeurs wijkt af voor FR0000000001: verwacht XPAR, ontvangen LSE'),'SYMBOL_IDENTITY_MISMATCH');
console.log('Yahoo currency/venue identity failure provenance PASS');
