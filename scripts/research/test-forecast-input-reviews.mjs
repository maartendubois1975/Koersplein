import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { loadCompanyCatalog } from '../history/company-register.mjs';
import { loadApprovedHistory } from './market-history-source.mjs';
import { forecastWindowHash, reviewedForecastWindow, assessForecastWindow } from './forecast-input-review.mjs';
import { sameSourcePrice } from '../../chart.js';

const reviewFile = JSON.parse(await fs.readFile('data/forecast-input-reviews.json', 'utf8'));
const evidence = JSON.parse(gunzipSync(await fs.readFile('research/forecast/2026-11-27/official-window-evidence.json.gz')));
const catalog = await loadCompanyCatalog('XAMS');
assert.equal(Object.keys(reviewFile.instruments).length, 2);
for (const [key, review] of Object.entries(reviewFile.instruments)) {
  const share = catalog.shares.find(item => item.isin === review.instrument.isin);
  const latest = JSON.parse(await fs.readFile('data/history/' + key + '.json', 'utf8')).coverage.lastDate;
  const input = await loadApprovedHistory(share, 'XAMS', { cutoff: latest });
  const before = JSON.stringify(input);
  const bars = reviewedForecastWindow(input, review, review.instrument, review.asOf);
  assert.equal(JSON.stringify(input), before, 'Reviewed model window leaves all source records unchanged');
  assert.equal(bars.length, 253);
  assert.equal(assessForecastWindow(bars, review.asOf).status, 'READY');
  const official = evidence.instruments.find(row => row.key === key);
  assert(official.quote.identityMatch);
  assert.equal(official.quote.currency, 'EUR');
  assert.deepEqual(official.official, official.adjusted);
  assert.equal(forecastWindowHash(official.official), review.officialWindowSha256);
  for (let index = 0; index < bars.length; index++) {
    const row = bars[index], observed = official.official[index];
    assert.equal(row.date, observed.date);
    assert.equal(row.volume, observed.volume);
    for (const field of ['open', 'high', 'low', 'close']) assert(sameSourcePrice(row[field], observed[field]));
  }
  const modified = structuredClone(input);
  modified.find(row => row.date === review.firstDate).close += 1;
  assert.throws(() => reviewedForecastWindow(modified, review, review.instrument, review.asOf), /OBSERVATION_CHANGED/);
  assert.throws(() => reviewedForecastWindow(input, review, { ...review.instrument, currency: 'USD' }, review.asOf), /MISMATCH/);
  assert.throws(() => reviewedForecastWindow(input, review, { ...review.instrument, mic: 'MTAA' }, review.asOf), /MISMATCH/);
  assert.throws(() => reviewedForecastWindow(input, review, review.instrument, '2026-11-27'), /MISMATCH/);
  const changedReview = structuredClone(review);
  changedReview.resolutions[0].official[changedReview.resolutions[0].fields[0]] += 0.001;
  assert.throws(() => reviewedForecastWindow(input, changedReview, review.instrument, review.asOf), /VALUES_CHANGED/);
  const missing = input.filter(row => row.date !== review.firstDate);
  assert.throws(() => reviewedForecastWindow(missing, review, review.instrument, review.asOf), /OBSERVATION_CHANGED/);
}
console.log('Two actual 253-session forecast windows, source-mode equivalence, bounded corrections and changed-input rejection PASS');
