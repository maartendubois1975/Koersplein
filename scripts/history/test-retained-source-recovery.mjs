import fs from 'node:fs/promises';
import os from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { gunzipSync, gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { reviewRetainedHistory, restoreRetainedHistory } from './retained-history-review.mjs';
import { planNoTradeIntervals, applyNoTradeIntervals } from './session-evidence-review.mjs';
import { tradedHistoryRows, buildChartModel } from '../../chart.js';
import { previousConfirmedBar, sessionSnapshotAt } from '../../daily-session-view.mjs';
import { loadApprovedHistory } from '../research/market-history-source.mjs';
import { approvedCompanyUniverse, validateCompanyCatalog } from './company-register.mjs';
import { operationalMarketIssues } from './market-definitions.mjs';
import { withArchiveWriter } from './archive-writer-lock.mjs';

const root = resolve('.'), folder = 'research/completion/2026-11-28/source-block/';
const read = file => fs.readFile(file, 'utf8').then(JSON.parse);
const hash = raw => createHash('sha256').update(raw).digest('hex');
const review = await read(folder + 'retained-history-review.json');
const baseline = JSON.parse(gunzipSync(await fs.readFile(folder + 'session-review-inputs.json.gz')));
const evidence = JSON.parse(gunzipSync(await fs.readFile(review.evidenceFile)));
const now = new Date(Math.max(Date.parse(review.observedAt), Date.parse(baseline.reviewedAt)) + 1);
const temporary = await fs.mkdtemp(join(os.tmpdir(), 'koersplein-retained-proof-'));
const dataDir = join(temporary, 'data');
try {
  for (const row of baseline.files) {
    const file = join(dataDir, row.file); await fs.mkdir(join(file, '..'), { recursive: true }); await fs.writeFile(file, row.raw);
  }
  await assert.rejects(() => reviewRetainedHistory({ ...review, evidenceSha256: '0'.repeat(64) }, { dataDir, now, root }), /EVIDENCE_CHANGED/);
  const wrong = structuredClone(evidence), source = wrong.documents[0], doc = JSON.parse(source.raw);
  doc.instrument.currency = 'USD'; source.raw = JSON.stringify(doc); source.sha256 = hash(source.raw);
  const bytes = gzipSync(Buffer.from(JSON.stringify(wrong))), wrongFile = join(temporary, 'wrong.json.gz'); await fs.writeFile(wrongFile, bytes);
  await assert.rejects(() => restoreRetainedHistory({ ...review, evidenceFile: wrongFile, evidenceSha256: hash(bytes) }, { dataDir, now, root }), /CURRENCY_OR_DATE_MISMATCH/);
  const plan = await reviewRetainedHistory(review, { dataDir, now, root });
  assert.equal(plan.companies.length, 85); assert.equal(plan.writes.length, 54);
  assert.equal(plan.writes.reduce((n, row) => n + row.document.bars.length, 0), 36479);
  assert.equal(plan.companies.filter(row => row.status === 'NO_COMPLETE_RETAINED_TRADES').length, 3);
  assert.equal(plan.companies.filter(row => row.status === 'NO_RETAINED_MANIFEST_IDENTITY').length, 28);
  await withArchiveWriter(dataDir, async () => {
    await assert.rejects(() => restoreRetainedHistory(review, { dataDir, now, root }), /HISTORY_WRITER_BUSY/);
  });
  const restored = await restoreRetainedHistory(review, { dataDir, now, root });
  assert.equal(restored.restoredBars, 36479);
  const initialHashes = await Promise.all(plan.writes.map(async row => [row.file, hash(await fs.readFile(row.file))]));
  const again = await restoreRetainedHistory(review, { dataDir, now, root });
  assert.equal(again.restoredCompanies, 0);
  for (const [file, sha] of initialHashes) assert.equal(hash(await fs.readFile(file)), sha);
  for (const row of plan.writes) {
    const saved = await read(row.file), selection = tradedHistoryRows(saved.bars);
    assert.equal(selection.excluded, 0);
    assert.equal(buildChartModel(selection.bars).filtered.length, selection.bars.length);
    const last = selection.bars.at(-1);
    assert.equal(previousConfirmedBar({ date: '2026-11-27', lastConfirmedBar: last }).date, last.date);
    await assert.rejects(() => loadApprovedHistory(saved.instrument, 'XPAR', {
      dataDir, currency: 'EUR', cutoff: '2026-11-27', requirePredictionEvidence: true,
    }), /PROVENANCE_UNVERIFIED/);
  }
  let total = 0, referenceOnly = 0;
  for (const source of evidence.documents) {
    const raw = JSON.parse(source.raw), selected = tradedHistoryRows(raw.bars);
    total += selected.bars.length;
    if (!selected.bars.length) referenceOnly++;
    assert.equal(selected.bars.length + selected.excluded, raw.bars.length, 'No raw source observation is lost from the proof');
  }
  assert.equal(total, 36479); assert.equal(referenceOnly, 3);

  const interval = await planNoTradeIntervals({ dataDir, now: new Date(baseline.reviewedAt) });
  assert(interval.actions.length > 0);
  const committedPrices = new Map();
  for (const file of await fs.readdir(join(dataDir, 'history'))) committedPrices.set(file, hash(await fs.readFile(join(dataDir, 'history', file))));
  await assert.rejects(() => applyNoTradeIntervals({ ...interval, actions: [] }, { dataDir, now }), /PLAN_CHANGED/);
  const result = await applyNoTradeIntervals(interval, { dataDir, now });
  assert.equal(result.status, 'REVIEW_COMPLETED'); assert.deepEqual(result.errors, []);
  for (const action of interval.actions) {
    const saved = await read(join(dataDir, 'daily-sessions', action.market, action.session + '.json'));
    const row = saved.results.find(row => row.isin === action.isin);
    assert.equal(row.status, 'NO_TRADES'); assert.equal(row.bar, null);
    assert.deepEqual(row.priorUnverifiedEvidence, action.before);
    assert.equal(row.evidence.scope, 'RETROSPECTIVE_SESSION_STATUS_ONLY');
    assert(row.evidence.knownAt > action.session);
    assert.deepEqual(sessionSnapshotAt(saved, new Date(action.session + 'T22:00:00Z')).results.find(row => row.isin === action.isin), action.before);
    assert.equal(sessionSnapshotAt(saved, now).results.find(row => row.isin === action.isin).status, 'NO_TRADES');
  }
  for (const [file, sha] of committedPrices) assert.equal(hash(await fs.readFile(join(dataDir, 'history', file))), sha, 'A session-status review cannot alter prices');
  assert.equal((await applyNoTradeIntervals(interval, { dataDir, now })).status, 'ALREADY_REVIEWED');
  const first = interval.actions[0], targetFile = join(dataDir, 'daily-sessions', first.market, first.session + '.json');
  const savedTarget = await fs.readFile(targetFile);
  const tampered = JSON.parse(savedTarget); tampered.results.find(row => row.isin === first.isin).priorUnverifiedEvidence.reasonCode = 'CORRUPTED';
  await fs.writeFile(targetFile, JSON.stringify(tampered));
  await assert.rejects(() => applyNoTradeIntervals(interval, { dataDir, now }), /INPUT_CHANGED/);
  await fs.writeFile(targetFile, savedTarget);
  console.log('57 retained sources: 54 restored/36479 real OHLCV rows, 3 reference-only and 28 absent; immutable sources, chart selection, blocked model admission and bounded retrospective status recovery PASS (' + interval.actions.length + ' sessions)');
} finally { await fs.rm(temporary, { recursive: true, force: true }); }

const contracts = await read('data/company-register-contracts.json');
const oslo = await read('research/oslo/2026-11-28/candidate-companies.json');
validateCompanyCatalog(oslo, contracts.catalogPreviews.XOSL);
assert.equal(new Set(oslo.shares.map(row => row.issuerId)).size, 244);
const bridge = await read('research/oslo/2026-11-28/romreal-issuer-bridge.json');
assert.equal(bridge.primary.isinAsPrinted.replace(/\s+/g, ''), bridge.isin);
assert.equal(bridge.primary.registeredAs, bridge.gleif.registeredAs);
assert.equal(hash(await fs.readFile(bridge.gleif.file)), bridge.gleif.sha256);
assert(operationalMarketIssues(oslo, contracts.catalogPreviews.XOSL).length > 0);
const active = await approvedCompanyUniverse();
assert.equal(active.reduce((n, market) => n + market.shares.length, 0), 899);
assert(!active.some(row => row.mic === 'XOSL'));
console.log('244 unique Oslo issuer identities; exact RomReal registration bridge; operational admission remains blocked PASS');
