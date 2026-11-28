import fs from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { approvedCompanyUniverse } from './company-register.mjs';
import { latestClosedSession, sessionCalendar } from './trading-calendar.mjs';
import { listingIdentity, validSessionDate } from '../../daily-session-view.mjs';
import { validateSnapshot, archiveApprovedSessions, writeArchiveDocument } from '../cloudflare/archive-approved-session.mjs';

const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const read = async file => { try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; } };

export async function planNoTradeIntervals({ dataDir = 'data', now = new Date() } = {}) {
  const actions = [], blocked = [], inputs = [];
  for (const catalog of await approvedCompanyUniverse()) {
    const market = catalog.mic, snapshots = [], closed = latestClosedSession(market, now);
    const folder = join(dataDir, 'daily-sessions', market);
    for (const file of (await fs.readdir(folder).catch(error => { if (error.code === 'ENOENT') return []; throw error; })).sort()) {
      if (!file.endsWith('.json')) continue;
      const raw = await fs.readFile(join(folder, file), 'utf8'), snapshot = validateSnapshot(JSON.parse(raw), catalog, market);
      if (file !== snapshot.session + '.json' || snapshot.session > closed || !sessionCalendar(market, snapshot.session).open) throw Error('INTERVAL_ARCHIVE_DATE_INVALID');
      snapshots.push(snapshot); inputs.push({ file: join('daily-sessions', market, file), sha256: hash(raw) });
    }
    const histories = new Map();
    for (const target of snapshots) for (const before of target.results.filter(row => row.status === 'SESSION_UNVERIFIED')) {
      const share = catalog.shares.find(row => listingIdentity(row, market, target.session).isin === before.isin);
      if (!share) continue;
      const identity = listingIdentity(share, market, target.session);
      if (!histories.has(identity.storageKey)) {
        const records = [];
        for (const file of [join('history', identity.storageKey + '.json'),
          join(market === 'XAMS' ? 'history' : 'test-history', (market === 'XAMS' ? identity.isin : identity.storageKey) + '.json')]) {
          const doc = await read(join(dataDir, file));
          if (!doc) continue;
          if (doc.instrument?.isin !== identity.isin || doc.instrument?.mic !== identity.mic || doc.instrument?.symbol !== identity.symbol) throw Error('INTERVAL_HISTORY_IDENTITY_MISMATCH');
          inputs.push({ file, sha256: hash(await fs.readFile(join(dataDir, file), 'utf8')) });
          records.push(...doc.bars);
        }
        histories.set(identity.storageKey, records);
      }
      for (const source of snapshots.filter(snapshot => snapshot.session >= target.session)) {
        const row = source.results.find(row => row.isin === before.isin && row.mic === before.mic && row.symbol === before.symbol);
        const proof = row?.evidence, observed = proof?.stateObservedAt;
        const lag = (Date.parse(observed?.slice(0, 10)) - Date.parse(target.session)) / 86400000;
        if (row?.status !== 'NO_TRADES' || proof?.verification !== 'OFFICIAL_LAST_EXECUTED_DATE_AND_ZERO_VOLUME_SESSION' ||
            proof.date !== source.session || proof.isin !== identity.isin || proof.mic !== identity.mic ||
            proof.provider !== 'euronext-live' || proof.volume !== 0 || !/^[a-f0-9]{64}$/.test(proof.quoteSha256 ?? '') ||
            !validSessionDate(proof.lastTradeDate) || proof.lastTradeDate >= target.session ||
            !Number.isInteger(lag) || lag < 0 || lag > 7 || new Date(observed) > now ||
            latestClosedSession(market, new Date(observed)) < source.session ||
            listingIdentity(share, market, source.session).storageKey !== identity.storageKey ||
            proof.quoteSourceUrl !== 'https://live.euronext.com/en/ajax/getDetailedQuote/' + identity.isin + '-' + identity.mic) continue;
        const contradicts = snapshots.some(snapshot => snapshot.session > proof.lastTradeDate && snapshot.session <= source.session &&
          snapshot.results.some(item => item.isin === identity.isin && item.mic === identity.mic && item.status === 'TRADED')) ||
          histories.get(identity.storageKey).some(bar => bar.date > proof.lastTradeDate && bar.date <= source.session && Number(bar.volume) > 0);
        if (contradicts) { blocked.push({ market, isin: identity.isin, session: target.session, reason: 'STORED_TRADE_CONTRADICTS_LAST_EXECUTED_DATE' }); break; }
        const sourceRowHash = hash(row), reviewId = hash([market, target.session, identity.storageKey, source.session, sourceRowHash]);
        const after = { ...identity, status: 'NO_TRADES', bar: null, provider: row.provider, sourceUrl: row.sourceUrl,
          evidence: { date: target.session, isin: identity.isin, mic: identity.mic, provider: proof.provider,
            status: 'NO_TRADES', lastTradeDate: proof.lastTradeDate, volume: 0,
            verification: 'RETAINED_OFFICIAL_NO_TRADE_INTERVAL', observedAt: observed, reviewedAt: now.toISOString(),
            knownAt: now.toISOString(), scope: 'RETROSPECTIVE_SESSION_STATUS_ONLY',
            sourceSession: source.session, sourceRowHash, sourceRow: row, reviewId }, priorUnverifiedEvidence: before };
        delete after.storageKey;
        actions.push({ market, session: target.session, isin: identity.isin, before, after, reviewId }); break;
      }
    }
  }
  const core = { schemaVersion: 1, mode: 'BOUNDED_RETAINED_NO_TRADE_REVIEW', reviewedAt: now.toISOString(), actions, blocked, inputs };
  return { ...core, planHash: hash(core) };
}

export async function applyNoTradeIntervals(plan, { dataDir = 'data', now = new Date() } = {}) {
  const { planHash, ...core } = plan;
  if (planHash !== hash(core) || plan.mode !== 'BOUNDED_RETAINED_NO_TRADE_REVIEW' || new Date(plan.reviewedAt) > now) throw Error('INTERVAL_PLAN_CHANGED');
  const groups = new Map();
  for (const action of plan.actions) {
    const key = action.market + '/' + action.session;
    if (!groups.has(key)) groups.set(key, { market: action.market, session: action.session, actions: [] });
    groups.get(key).actions.push(action);
  }
  let already = true;
  for (const group of groups.values()) {
    const snapshot = await read(join(dataDir, 'daily-sessions', group.market, group.session + '.json'));
    for (const action of group.actions) {
      const row = snapshot?.results.find(row => row.isin === action.isin);
      if (row?.evidence?.reviewId !== action.reviewId || hash(row.priorUnverifiedEvidence) !== hash(action.before)) already = false;
    }
  }
  if (already) return { status: 'ALREADY_REVIEWED', reviewedSessions: 0, planHash };
  const temporary = await fs.mkdtemp(join(os.tmpdir(), 'koersplein-session-review-'));
  try {
    for (const group of groups.values()) {
      const snapshot = await read(join(dataDir, 'daily-sessions', group.market, group.session + '.json'));
      snapshot.previousSnapshotGeneratedAt ??= snapshot.generatedAt;
      snapshot.generatedAt = plan.reviewedAt;
      snapshot.sessionEvidenceReviewedAt = plan.reviewedAt;
      snapshot.results = snapshot.results.map(row => group.actions.find(action => action.isin === row.isin)?.after ?? row);
      await writeArchiveDocument(join(temporary, group.market, group.session + '.json'), snapshot);
    }
    const report = await archiveApprovedSessions({ dataDir, inputDir: temporary,
      markets: [...new Set([...groups.values()].map(group => group.market))],
      replaySessions: [...groups.values()].map(({ market, session }) => ({ market, session })), reviewedSessionReplay: true, now,
      beforeArchive: async () => {
        const current = await planNoTradeIntervals({ dataDir, now: new Date(plan.reviewedAt) });
        if (current.planHash !== planHash) throw Error('INTERVAL_INPUT_CHANGED');
      } });
    return { status: report.errors.length ? 'PARTIAL_REVIEW_REQUIRED' : 'REVIEW_COMPLETED', planHash,
      reviewedSessions: plan.actions.length, ...report };
  } finally { await fs.rm(temporary, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [mode, file, output] = process.argv.slice(2);
  if (mode === 'plan') { const plan = await planNoTradeIntervals(); await writeArchiveDocument(file, plan);
    console.log(JSON.stringify({ actions: plan.actions.length, blocked: plan.blocked.length })); }
  else if (mode === 'apply' && output) { const result = await applyNoTradeIntervals(await read(file));
    await writeArchiveDocument(output, result); console.log(JSON.stringify(result)); }
  else throw Error('INTERVAL_REVIEW_COMMAND_REQUIRED');
}
