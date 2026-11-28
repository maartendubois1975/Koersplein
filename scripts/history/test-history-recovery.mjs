import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { loadCompanyCatalog } from './company-register.mjs';
import { listingIdentity } from '../../daily-session-view.mjs';
import { archiveApprovedSessions } from '../cloudflare/archive-approved-session.mjs';
import { collectApprovedSessionWithRecovery } from '../cloudflare/approved-daily-session.mjs';
import { planStoredHistoryRecovery, applyStoredHistoryRecovery, reviewHistoryGaps } from './history-gap-review.mjs';
import { withArchiveWriter } from './archive-writer-lock.mjs';
import { historyCoverage } from './history-coverage.mjs';
import { sessionCalendar } from './trading-calendar.mjs';

const read = file => fs.readFile(file, 'utf8').then(JSON.parse);
const write = (file, doc) => fs.writeFile(file, JSON.stringify(doc, null, 2) + '\n');
const hash = raw => createHash('sha256').update(raw).digest('hex');
const catalog = await loadCompanyCatalog('XAMS');
const names = (await fs.readdir('data/daily-sessions/XAMS')).filter(name => name.endsWith('.json')).sort().slice(-2);
assert.equal(names.length, 2);
const snapshots = await Promise.all(names.map(name => read('data/daily-sessions/XAMS/' + name)));
const last = snapshots.at(-1), now = new Date(last.session + 'T22:00:00Z');
const shares = ['ASML', 'ADYEN'].map(symbol => catalog.shares.find(share => share.symbol === symbol));
for (const snap of snapshots) for (const share of shares) assert.equal(snap.results.find(row => row.isin === share.isin).status, 'TRADED');
const temporary = await fs.mkdtemp(join(os.tmpdir(), 'koersplein-history-recovery-'));
const dataDir = join(temporary, 'data'), inputDir = join(temporary, 'input');
await fs.mkdir(inputDir);
const originals = new Map();
try {
  for (const snap of snapshots) {
    await write(join(inputDir, 'daily-session-XAMS.json'), snap);
    const saved = await archiveApprovedSessions({ inputDir, dataDir, markets: ['XAMS'] });
    assert.deepEqual(saved.errors, []);
  }
  for (const share of shares) {
    const key = listingIdentity(share, 'XAMS').storageKey;
    const file = join(dataDir, 'history', key + '.json');
    originals.set(file, await fs.readFile(file));
    const doc = JSON.parse(originals.get(file));
    doc.bars = doc.bars.filter(bar => bar.date !== last.session);
    doc.coverage = { ...doc.coverage, lastDate: doc.bars.at(-1).date, records: doc.bars.length, recordCount: doc.bars.length };
    await write(file, doc);
  }
  const plan = await planStoredHistoryRecovery({ dataDir, now });
  assert.equal(plan.actions.length, 2, JSON.stringify(plan.errors));
  assert.deepEqual(plan.errors, []);
  assert.equal(plan.sessions.length, 1);
  await assert.rejects(() => applyStoredHistoryRecovery({ ...plan, actions: [] }, { dataDir, now }), /RECOVERY_PLAN_CHANGED/);
  await withArchiveWriter(dataDir, async () => {
    await assert.rejects(() => applyStoredHistoryRecovery(plan, { dataDir, now }), /HISTORY_WRITER_BUSY/);
    await assert.rejects(() => archiveApprovedSessions({ dataDir }), /HISTORY_WRITER_BUSY/);
  });
  // Simulate a process dying after one genuine price file was restored.
  const firstFile = [...originals.keys()][0];
  await fs.writeFile(firstFile, originals.get(firstFile));
  const result = await applyStoredHistoryRecovery(plan, { dataDir, now });
  assert.equal(result.status, 'REPLAY_COMPLETED');
  assert.deepEqual(result.errors, []);
  for (const [file, raw] of originals) assert.equal(hash(await fs.readFile(file)), hash(raw), 'Exact original OHLCV and metadata restored');
  const second = await applyStoredHistoryRecovery(plan, { dataDir, now });
  assert.equal(second.status, 'ALREADY_REPAIRED');
  for (const [file, raw] of originals) assert.equal(hash(await fs.readFile(file)), hash(raw), 'Repeated application must be byte-idempotent');
  assert.equal((await planStoredHistoryRecovery({ dataDir, now })).actions.length, 0);

  // Deliberate fault injection is not a candidate market observation.
  const corrupted = JSON.parse(originals.get(firstFile));
  corrupted.bars.at(-1).volume++;
  await write(firstFile, corrupted);
  const conflict = await planStoredHistoryRecovery({ dataDir, now });
  assert(conflict.conflicts.some(row => row.reason === 'EXISTING_HISTORY_PRESERVED'));
  assert.equal(conflict.actions.length, 0);
  await assert.rejects(() => applyStoredHistoryRecovery(plan, { dataDir, now }), /RECOVERY_UNPLANNED_HISTORY_CHANGED/);
  assert.equal((await read(firstFile)).bars.at(-1).volume, corrupted.bars.at(-1).volume, 'Existing contradictory evidence is never overwritten');
  await fs.writeFile(firstFile, originals.get(firstFile));
  const archiveFile = join(dataDir, 'daily-sessions/XAMS', last.session + '.json');
  const originalArchive = await fs.readFile(archiveFile);
  await fs.writeFile(archiveFile, '{broken');
  const broken = await planStoredHistoryRecovery({ dataDir, now });
  assert(broken.errors.length);
  await assert.rejects(() => applyStoredHistoryRecovery(broken, { dataDir, now }), /RECOVERY_PLAN_HAS_ARCHIVE_ERRORS/);
  await fs.writeFile(archiveFile, originalArchive);
  const future = new Date(last.session + 'T00:00:00Z'); future.setUTCDate(future.getUTCDate() + 1);
  const futureDate = future.toISOString().slice(0, 10);
  await write(join(dataDir, 'daily-sessions/XAMS', futureDate + '.json'), { ...last, session: futureDate });
  assert((await planStoredHistoryRecovery({ dataDir, now })).errors.some(row => row.reason === 'RECOVERY_SESSION_NOT_APPROVED_CLOSED_DAY'));
} finally { await fs.rm(temporary, { recursive: true, force: true }); }

const observation = last.results.find(row => row.isin === shares[0].isin).bar;
const identity = listingIdentity(shares[0], 'XAMS');
const coverageInput = { identity, archive: { rows: [observation] }, legacy: { rows: [observation] },
  statuses: new Map([[last.session, { status: 'TRADED', bar: observation }]]), sessions: [last.session], start: last.session, cutoff: last.session };
const coverage = historyCoverage(coverageInput);
assert.equal(coverage.coverage.completeUniqueDays, 1, 'Overlapping histories must count once');
assert.equal(coverage.coverage.confirmedArchiveDays, 1);
assert.equal(coverage.coverage.coveredSessions, 1);
const bad = historyCoverage({ ...coverageInput, archive: { rows: [{ ...observation, volume: observation.volume + 1 }] } });
assert.equal(bad.coverage.completeUniqueDays, 0);
assert.equal(bad.coverage.sourceConflicts.length, 1);
assert.deepEqual(bad.missing, [last.session]);
const contradictoryStatus = historyCoverage({ ...coverageInput, statuses: new Map([[last.session, { status: 'NO_TRADES' }]]) });
assert.equal(contradictoryStatus.coverage.statusConflicts.length, 1);
assert.equal(contradictoryStatus.coverage.completeUniqueDays, 0);
assert.equal(contradictoryStatus.coverage.coveredSessions, 0, 'Contradictory trade-status evidence cannot count as reliable coverage');
const invalid = historyCoverage({ ...coverageInput, legacy: null, archive: { rows: [observation], invalidDates: [observation.date] } });
assert.equal(invalid.coverage.completeUniqueDays, 0);
const resolutions = await read('data/history-chart-resolutions.json');
const realReview = Object.values(resolutions.instruments).find(review => review.resolutions.some(row => row.base));
const proof = realReview.resolutions.find(row => row.base);
const sourceInput = { identity: realReview.instrument, review: realReview,
  archive: { rows: [proof.incoming] }, legacy: { rows: [proof.base] }, statuses: new Map(),
  sessions: [proof.date], start: proof.date, cutoff: proof.date };
const reconciled = historyCoverage(sourceInput);
assert.equal(reconciled.coverage.completeUniqueDays, 1);
assert.equal(reconciled.coverage.reviewedSourceDays, 1);
const absentBase = historyCoverage({ ...sourceInput, legacy: null });
assert.equal(absentBase.coverage.sourceConflicts.length, 0, 'Unavailable chart bases are not invented source contradictions');
assert.deepEqual(absentBase.coverage.sourceReviewUnavailable, [proof.date]);

const rows = shares.map(share => last.results.find(row => row.isin === share.isin));
const subset = { ...catalog, shares };
const calls = new Map();
const collected = await collectApprovedSessionWithRecovery({ market: 'XAMS', session: last.session, now, catalog: subset,
  official: async instrument => {
    calls.set(instrument.isin, (calls.get(instrument.isin) ?? 0) + 1);
    if (instrument.isin === shares[1].isin) throw Error('PROVIDER_CURRENCY_MISMATCH');
    if (calls.get(instrument.isin) === 1) throw Error('Euronext HTTP 503');
    return { ...rows[0], date: last.session };
  }, registry: { async fetchDaily(instrument) { throw Error(instrument.isin === shares[0].isin ? 'Network timeout' : 'PROVIDER_CURRENCY_MISMATCH'); } },
}, { wait: async () => {} });
assert.equal(collected.recovery.retried, 1);
assert.equal(collected.recovery.recovered, 1);
assert.equal(collected.recovery.remainingUnverified, 1);
assert.equal(calls.get(shares[0].isin), 2);
assert.equal(calls.get(shares[1].isin), 1, 'Identity/currency review is not a transient failure');
assert.deepEqual(collected.results.find(row => row.isin === shares[0].isin).bar, rows[0].bar);
const cached = await collectApprovedSessionWithRecovery({ market: 'XAMS', session: last.session, now, catalog: subset,
  priorSnapshot: { ...last, results: rows },
  official: async () => { throw Error('Confirmed rows must not be requested'); },
  registry: { fetchDaily() { assert.fail('Confirmed rows must not be requested'); } },
}, { wait: async () => { assert.fail('No recovery wait for confirmed rows'); } });
assert.equal(cached.recovery.retried, 0);
assert.equal(cached.recovery.reusedConfirmed, 2);
await assert.rejects(() => collectApprovedSessionWithRecovery({ market: 'XAMS', session: last.session, now: new Date(last.session + 'T08:00:00Z'), catalog: subset }), /Invalid or unclosed/);
assert(sessionCalendar('XAMS', last.session).open);
let requested = 0;
await assert.rejects(() => reviewHistoryGaps({ mic: 'XAMS', latestClosed: last.session }, {
  ...identity, currency: 'EUR', issues: [], gapWindowStart: last.session, missing: [last.session], unverified: [], unverifiedWithBar: [],
}, { startDate: last.session, endDate: last.session }, 'yahoo-chart', {
  registry: { async fetchDaily() { requested++; assert.fail('Unverified publication rights must block the request'); } },
}), /UNVERIFIED_GAP_SOURCE_RIGHTS/);
assert.equal(requested, 0);
console.log('Real archived OHLCV: partial-write recovery, immutable evidence, idempotence, writer collision, conflicts, calendar/rights gates and targeted transient retry PASS');
