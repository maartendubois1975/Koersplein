import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { approvedCompanyUniverse, validateCompanyCatalog } from './company-register.mjs';
import { sessionCalendar } from './trading-calendar.mjs';
import { parseEuronextQuoteHeader } from './providers/euronext-live.mjs';

const read = path => readFile(new URL('../../' + path, import.meta.url), 'utf8').then(JSON.parse);
const active = await approvedCompanyUniverse();
const occupiedIsins = new Set(active.flatMap(market => market.shares.map(share => share.isin)));

const milanReview = 'research/milan/2026-11-26/';
const osloReview = 'research/oslo/2026-11-26/';
const milan = await read(milanReview + 'approved-companies.json');
const oslo = await read(osloReview + 'candidate-companies.json');
const milanEvidence = await read(milanReview + 'summary.json');
const osloEvidence = await read(osloReview + 'summary.json');
const contracts = await read('data/company-register-contracts.json');
assert.deepEqual(contracts.catalogPreviews.XMIL, {
  file: '../' + milanReview + 'approved-companies.json',
  expectedCount: milanEvidence.decisions.INCLUDE,
  identitySha256: milanEvidence.identitySha256,
});
assert(!contracts.markets.XMIL, 'Preview must stay outside public raw-price archiving');
for (const [catalog, expectedCount, identitySha256] of [
  [milan, milanEvidence.decisions.INCLUDE, milanEvidence.identitySha256],
  [oslo, osloEvidence.counts.INCLUDE, osloEvidence.identitySha256],
]) {
  validateCompanyCatalog(catalog, { expectedCount, identitySha256 });
  for (const share of catalog.shares) {
    assert(!occupiedIsins.has(share.isin), 'Duplicate listing across market registers: ' + share.isin);
    occupiedIsins.add(share.isin);
    assert.equal(sessionCalendar(share.primaryMic, '2026-11-25').market, catalog.mic);
  }
}
assert(milan.shares.some(share => share.symbol === 'MFEB'));
assert(!milan.shares.some(share => ['MFEA', 'RACE', 'RMT', 'REC', 'STMMI'].includes(share.symbol)));
assert.equal(milan.shares.find(share => share.symbol === 'ITD').primaryMic, 'MTAA');
assert.equal(oslo.shares.find(share => share.symbol === 'CAPT').primaryMic, 'XOSL');

const instrument = (isin, mic, currency) => ({ isin, mic, currency });
const quote = (address, currency) =>
  '<p class="address__text">' + address + '</p><span id="header-instrument-currency">' + currency + '</span>';
const milanQuote = quote('Euronext Milan IT0001233417 - Stock', '€');
assert(parseEuronextQuoteHeader(milanQuote, instrument('IT0001233417', 'MTAA', 'EUR')).identityMatch);
assert(!parseEuronextQuoteHeader(milanQuote, instrument('IT0001233417', 'EXGM', 'EUR')).identityMatch);
assert(!parseEuronextQuoteHeader(milanQuote.replace('€', 'NOK'), instrument('IT0001233417', 'MTAA', 'EUR')).identityMatch);
const osloQuote = quote('Oslo Børs MHY1096C1093 - Stock', 'NOK');
assert(parseEuronextQuoteHeader(osloQuote, instrument('MHY1096C1093', 'XOSL', 'NOK')).identityMatch);
assert(!parseEuronextQuoteHeader(osloQuote, instrument('MHY1096C1093', 'MERK', 'NOK')).identityMatch);
console.log('Milan and Oslo candidate registers, segment calendars and quote identity guards: PASS');
