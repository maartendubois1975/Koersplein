import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { parseEuronextHistoryRows, parseEuronextQuoteHeader } from '../history/providers/euronext-live.mjs';
import { reconcileTradeDetails } from './reconcile-euronext-trade-details.mjs';
const root = 'research/completion/2026-11-27/';
const evidence = JSON.parse(gunzipSync(await fs.readFile(root + 'milan-history-table-evidence.json.gz')));
const baseline = JSON.parse(await fs.readFile('research/milan/2026-11-27/official-daily-observations.json', 'utf8'));
const saved = JSON.parse(await fs.readFile(root + 'milan-price-definitions.json', 'utf8'));
const official = baseline.map(share => {
  const source = evidence.find(row => row.isin === share.isin && row.mic === share.primaryMic);
  const bars = parseEuronextHistoryRows(source.html);
  assert.deepEqual(bars, [share.bar], 'Default importer OHLCV is unchanged');
  return { ...share, bar: parseEuronextHistoryRows(source.html, { includePriceDefinitions: true })[0] };
});
const audit = { approved: 360, session: '2026-11-26', observed: 309, unqualifiedRows: 0,
  listings: saved.listings.flatMap(row => row.trades ? [row.trades] : []) };
const report = reconcileTradeDetails(audit, official);
assert.equal(report.lastTradeMatches, 309);
assert.equal(report.volumeMatches, 309);
assert.equal(report.definitionUnresolved, 0);
assert.equal(report.referenceCloseDifferences, 7);
assert.equal(report.publicationApproved, false);
const profile = report.listings.find(row => row.symbol === 'PRO');
assert.equal(profile.official.close, 1.62); assert.equal(profile.official.lastTradePrice, 1.622);
assert.equal(profile.definitionStatus, 'OFFICIAL_REFERENCE_DISTINCT_FROM_LAST');
const arbs = report.listings.find(row => row.symbol === 'ARBS');
assert(arbs.trades.lastCandidatePrices.length > 1);
assert.equal(arbs.definitionStatus, 'OFFICIAL_REFERENCE_EQUALS_LAST');
const changed = structuredClone(official);
changed.find(row => row.symbol === 'PRO').bar.lastTradePrice = 1.638; // Real session high, not a last-price proof.
assert.equal(reconcileTradeDetails(audit, changed).definitionUnresolved, 1);
const quote = await fs.readFile(root + 'ahold-quote-excerpt.html', 'utf8');
assert.equal(parseEuronextQuoteHeader(quote, { isin: 'NL0011794037', mic: 'XAMS' }).identityMatch, true);
assert.equal(parseEuronextQuoteHeader(quote, { isin: 'NL0011794037', mic: 'XBRU' }).identityMatch, false);
assert.equal(parseEuronextQuoteHeader(quote, { isin: 'NL0011872650', mic: 'XAMS' }).identityMatch, false);
console.log('360 actual official Last/Close tables, 309 tape identities, seven reference closes and primary/secondary quote guard PASS');
