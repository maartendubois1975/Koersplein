import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { loadCompanyCatalog } from '../history/company-register.mjs';
import { loadApprovedHistory } from './market-history-source.mjs';
import { forecastWindowHash, reviewedForecastWindow, loadForecastHistory } from './forecast-input-review.mjs';
import { deriveForecastRollforward, resolveForecastReview, rollingKey, assertForecastEvaluationEvidence } from './forecast-rollforward.mjs';
import { refreshForecastInputReviews } from './refresh-forecast-input-reviews.mjs';

const fixture = JSON.parse(gunzipSync(await fs.readFile('research/admission/2026-11-27/rolling-replay-source.json.gz')));
const catalog = await loadCompanyCatalog('XAMS');
const now = new Date('2026-11-27T06:00:00Z');
const sources = new Map(), inputs = new Map();
const manifest = { schemaVersion: 1, instruments: {} };
for (const { seed, source } of fixture.records) {
  const share = catalog.shares.find(row => row.isin === seed.instrument.isin);
  const latest = JSON.parse(await fs.readFile('data/history/XAMS:' + share.isin + '.json', 'utf8')).coverage.lastDate;
  const bars = (await loadApprovedHistory(share, 'XAMS', { cutoff: latest })).filter(row => row.date <= source.cutoff);
  const prior = structuredClone(seed);
  prior.asOf = '2026-11-25'; prior.firstDate = '2025-11-28';
  const base = bars.filter(row => row.date >= prior.firstDate && row.date <= prior.asOf);
  assert.equal(base.length, 253);
  const model = base.map(row => {
    const resolution = prior.resolutions.find(item => item.date === row.date);
    return resolution ? { ...row, ...Object.fromEntries(resolution.fields.map(field => [field, resolution.official[field]])) } : row;
  });
  prior.rawWindowSha256 = forecastWindowHash(base); prior.modelWindowSha256 = forecastWindowHash(model);
  prior.officialWindowSha256 = forecastWindowHash(source.rawRows.filter(row => row.date <= prior.asOf));
  assert.equal(reviewedForecastWindow(bars, prior, prior.instrument, prior.asOf).length, 253);
  const entry = deriveForecastRollforward(bars, prior, source, now);
  assert.equal(entry.verifiedNewSessions, 1); assert.equal(entry.verifiedOverlap, 252);
  assert.equal(entry.review.asOf, source.cutoff);
  const stale = structuredClone(source); stale.source.retrievedAt = '2026-11-25T20:00:00Z';
  assert.throws(() => deriveForecastRollforward(bars, prior, stale, now), /SOURCE_NOT_FRESH/);
  const suspended = structuredClone(source); suspended.quote.tradingState = 'SUSPENDED';
  assert.throws(() => deriveForecastRollforward(bars, prior, suspended, now), /QUOTE_NOT_CONFIRMED/);
  const future = structuredClone(source); future.cutoff = '2026-11-27';
  assert.throws(() => deriveForecastRollforward(bars, prior, future, now), /NOT_NEW_CLOSED/);
  const revised = structuredClone(source);
  for (const rows of [revised.rawRows, revised.adjustedRows]) rows.find(row => row.date === '2026-11-25').high = Math.max(...rows.map(row => row.high));
  assert.throws(() => deriveForecastRollforward(bars, prior, revised, now), /OVERLAP_CHANGED|SOURCE_BLOCKED/);
  const correction = structuredClone(source);
  for (const rows of [correction.rawRows, correction.adjustedRows]) rows.find(row => row.date === '2026-11-26').high = Math.max(...rows.map(row => row.high));
  assert.throws(() => deriveForecastRollforward(bars, prior, correction, now), /NEW_CORRECTION|SOURCE_BLOCKED/);
  const action = structuredClone(source);
  const capital = fixture.records[0].source.notices.events.find(row => row.type.includes('Capital increase'));
  action.notices.events.push({ ...capital, id: capital.id + '-CHANGED', effective: '26 Nov 2026' }); action.notices.total++;
  assert.throws(() => deriveForecastRollforward(bars, prior, action, now), /CORPORATE_ACTION/);
  const key = 'XAMS:' + share.isin;
  manifest.instruments[key] = prior; sources.set(key, source); inputs.set(key, { share, bars });
}
const temp = await fs.mkdtemp(join(os.tmpdir(), 'koersplein-rollforward-'));
try {
  await fs.mkdir(join(temp, 'history'));
  for (const [key, { share }] of inputs) for (const name of [key, share.isin]) {
    const doc = JSON.parse(await fs.readFile(join('data/history', name + '.json'), 'utf8'));
    doc.bars = doc.bars.filter(row => row.date <= '2026-11-26');
    doc.coverage = { ...doc.coverage, firstDate: doc.bars[0].date, lastDate: doc.bars.at(-1).date, records: doc.bars.length };
    await fs.writeFile(join(temp, 'history', name + '.json'), JSON.stringify(doc));
  }
  const file = join(temp, 'forecast-input-reviews.json');
  await fs.writeFile(file, JSON.stringify(manifest));
  let requests = 0;
  const options = { dataDir: temp, cutoff: '2026-11-26', clock: () => now, catalogs: [catalog],
    fetchEvidence: async instrument => { requests++; return sources.get(instrument.mic + ':' + instrument.isin); } };
  let failedOnce = false;
  const partial = await refreshForecastInputReviews({ ...options, fetchEvidence: async instrument => {
    requests++;
    if (instrument.isin === 'NL0012969182' && !failedOnce) { failedOnce = true; throw Error('Temporary source unavailable'); }
    return sources.get(instrument.mic + ':' + instrument.isin);
  } });
  assert.equal(partial.results.filter(row => row.status === 'VERIFIED_ROLLFORWARD').length, 1);
  assert.equal(partial.results.filter(row => row.status === 'REVIEW_UNCONFIRMED').length, 1);
  assert.throws(() => assertForecastEvaluationEvidence(partial, 'XAMS:NL0012969182', '2026-11-26'), /EVALUATION_SOURCE_UNCONFIRMED/);
  assertForecastEvaluationEvidence(partial, 'XAMS:NL0011872650', '2026-11-26');
  const result = await refreshForecastInputReviews(options);
  assert.equal(result.results.filter(row => row.status === 'VERIFIED_ROLLFORWARD').length, 1);
  assert.equal(result.results.filter(row => row.status === 'ALREADY_REVIEWED').length, 1);
  const first = await fs.readFile(file, 'utf8');
  const saved = JSON.parse(first);
  assert.deepEqual(saved.instruments, manifest.instruments);
  for (const [key, { share }] of inputs) {
    assert(resolveForecastReview(saved, key, '2026-11-26'));
    assert.equal((await loadForecastHistory(share, 'XAMS', { dataDir: temp, cutoff: '2026-11-26' })).length, 253);
  }
  await refreshForecastInputReviews(options);
  assert.equal(await fs.readFile(file, 'utf8'), first); assert.equal(requests, 3, 'Retry requests only the one previously failed instrument');
  const changed = structuredClone(saved); changed.instruments[Object.keys(manifest.instruments)[0]].source.quoteSha256 = '0'.repeat(64);
  assert.throws(() => resolveForecastReview(changed, Object.keys(manifest.instruments)[0], '2026-11-26'), /PARENT_CHANGED/);
  const key = Object.keys(manifest.instruments)[0], evidence = saved.rollforwards[rollingKey(key, '2026-11-26')].evidence;
  await fs.appendFile(join(temp, evidence.file), 'changed');
  await assert.rejects(() => loadForecastHistory(inputs.get(key).share, 'XAMS', { dataDir: temp, cutoff: '2026-11-26' }), /EVIDENCE_CHANGED/);
  const damaged = await refreshForecastInputReviews(options);
  assert(damaged.results.some(row => row.key === key && row.status === 'REVIEW_UNCONFIRMED'));
  assert.equal(requests, 3, 'Corrupt saved evidence is not silently replaced with a new source request');
} finally { await fs.rm(temp, { recursive: true, force: true }); }
console.log('Actual 25→26 source replay, 252-day overlap, blocked revisions/actions/future/corrections, immutable seed/evidence and zero-request retry PASS');
