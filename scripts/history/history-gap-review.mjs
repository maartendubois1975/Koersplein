import { pathToFileURL } from 'node:url';
import { validSessionDate } from '../../daily-session-view.mjs';
import { inspectDailyBarIntegrity } from '../cloudflare/europe-run-policy.mjs';
import { operationsReport } from './operations-report.mjs';
import { providerRoute } from './source-policy.mjs';
import { createDefaultProviderRegistry } from './provider-registry.mjs';
import { identityEventAt } from './company-register.mjs';
import { marketSources } from './market-definitions.mjs';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { validateHistoryDocument, mergeChartHistoryBars } from '../../chart.js';
import { listingIdentity } from '../../daily-session-view.mjs';
import { approvedCompanyUniverse } from './company-register.mjs';
import { latestClosedSession, sessionCalendar } from './trading-calendar.mjs';
import { archiveApprovedSessions, validateSnapshot } from '../cloudflare/archive-approved-session.mjs';

const digest = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
async function optional(file) {
  try { const raw = await fs.readFile(file); return { raw, doc: JSON.parse(raw) }; }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

// No provider calls: recover only what an approved, validated session already
// proved. New network observations still go through reviewHistoryGaps below.
export async function planStoredHistoryRecovery({ dataDir = 'data', now = new Date() } = {}) {
  const actions = [], sessions = [], inputs = [], targets = new Map(), errors = [], conflicts = [];
  const catalogs = await approvedCompanyUniverse();
  const reviews = (await optional(join(dataDir, 'history-chart-resolutions.json')))?.doc;
  const documents = new Map();
  async function history(relative, identity, currency) {
    if (!documents.has(relative)) {
      const saved = await optional(join(dataDir, relative));
      if (saved) {
        validateHistoryDocument(saved.doc, identity);
        if (saved.doc.instrument.currency !== currency) throw Error('RECOVERY_HISTORY_CURRENCY_MISMATCH');
      }
      documents.set(relative, saved);
    }
    return documents.get(relative);
  }
  for (const catalog of catalogs) {
    const market = catalog.mic, cutoff = latestClosedSession(market, now);
    const folder = join('daily-sessions', market);
    const names = await fs.readdir(join(dataDir, folder)).catch(error => {
      if (error.code === 'ENOENT') return []; throw error;
    });
    for (const name of names.sort()) {
      if (!name.endsWith('.json')) continue;
      const date = name.slice(0, -5), file = join(folder, name);
      try {
        if (!validSessionDate(date) || date > cutoff || !sessionCalendar(market, date).open) throw Error('RECOVERY_SESSION_NOT_APPROVED_CLOSED_DAY');
        const saved = await optional(join(dataDir, file));
        inputs.push({ file, sha256: digest(saved.raw) });
        const snapshot = validateSnapshot(saved.doc, catalog, market);
        if (snapshot.session !== date) throw Error('RECOVERY_SESSION_DATE_MISMATCH');
        let needed = false;
        for (const share of catalog.shares) {
          const identity = listingIdentity(share, market, date), currency = share.currency || catalog.currency || 'EUR';
          const row = snapshot.results.find(item => item.isin === identity.isin);
          if (row.status !== 'TRADED') continue;
          const relative = join('history', identity.storageKey + '.json');
          const target = await history(relative, identity, currency);
          const old = target?.doc.bars.find(bar => bar.date === date);
          if (old) {
            try { mergeChartHistoryBars([old], [row.bar]); }
            catch { conflicts.push({ market, isin: identity.isin, date, reason: 'EXISTING_HISTORY_PRESERVED' }); }
            continue;
          }
          // An older chart source is read-only, and cannot be contradicted.
          const legacyFile = join(market === 'XAMS' ? 'history' : 'test-history',
            (market === 'XAMS' ? identity.isin : identity.storageKey) + '.json');
          const legacy = await history(legacyFile, identity, currency);
          const prior = legacy?.doc.bars.find(bar => bar.date === date);
          if (prior) {
            try { mergeChartHistoryBars([prior], [row.bar], { identity, review: reviews?.instruments?.[identity.storageKey] }); }
            catch { conflicts.push({ market, isin: identity.isin, date, reason: 'LEGACY_SOURCE_CONFLICT_REQUIRES_REVIEW' }); continue; }
          }
          if (!targets.has(relative)) targets.set(relative, { file: relative, sha256: target ? digest(target.raw) : null,
            protectedDates: target?.doc.bars.map(bar => bar.date) ?? [],
            protectedBarsSha256: digest(target?.doc.bars ?? []) });
          actions.push({ market, session: date, isin: identity.isin, storageKey: identity.storageKey,
            file: relative, bar: row.bar, evidenceFile: file });
          needed = true;
        }
        if (needed) sessions.push({ market, session: date });
      } catch (error) { errors.push({ market, file, reason: error.message }); }
    }
  }
  // These source decisions and compatibility inputs affect safe admission too.
  for (const file of ['history-chart-resolutions.json', ...[...documents.keys()].filter(file => !targets.has(file))]) {
    const saved = await optional(join(dataDir, file));
    inputs.push({ file, sha256: saved ? digest(saved.raw) : null });
  }
  const core = { schemaVersion: 1, mode: 'STORED_APPROVED_SESSION_REPLAY_ONLY',
    cutoff: Object.fromEntries(catalogs.map(catalog => [catalog.mic, latestClosedSession(catalog.mic, now)])),
    registers: catalogs.map(catalog => ({ market: catalog.mic, companies: catalog.shares.map(share => [share.isin, share.symbol, share.primaryMic || catalog.mic]) })),
    actions, sessions, inputs, targets: [...targets.values()], conflicts, errors };
  return { ...core, planHash: digest(core) };
}

export async function applyStoredHistoryRecovery(plan, { dataDir = 'data', now = new Date() } = {}) {
  const { planHash, ...core } = plan;
  if (planHash !== digest(core) || plan.mode !== 'STORED_APPROVED_SESSION_REPLAY_ONLY') throw Error('RECOVERY_PLAN_CHANGED');
  if (plan.errors.length) throw Error('RECOVERY_PLAN_HAS_ARCHIVE_ERRORS');
  let alreadyApplied = false;
  const report = await archiveApprovedSessions({ dataDir, now, inputDir: join(dataDir, 'daily-sessions'),
    markets: Object.keys(plan.cutoff), replaySessions: plan.sessions,
    beforeArchive: async () => {
      const current = await planStoredHistoryRecovery({ dataDir, now });
      if (current.planHash === planHash) return;
      // Restart after a partial write is allowed only for this exact retained
      // evidence, unchanged old bars and an exact subset of planned additions.
      for (const input of plan.inputs) {
        const saved = await optional(join(dataDir, input.file));
        if ((saved ? digest(saved.raw) : null) !== input.sha256) throw Error('RECOVERY_INPUT_CHANGED');
      }
      for (const target of plan.targets) {
        const saved = await optional(join(dataDir, target.file));
        const bars = saved?.doc.bars ?? [];
        const protectedDates = new Set(target.protectedDates);
        if (digest(bars.filter(bar => protectedDates.has(bar.date))) !== target.protectedBarsSha256) throw Error('RECOVERY_PROTECTED_HISTORY_CHANGED');
        const additions = bars.filter(bar => !protectedDates.has(bar.date));
        if (additions.some(bar => !plan.actions.some(action => action.file === target.file && JSON.stringify(action.bar) === JSON.stringify(bar)))) throw Error('RECOVERY_UNPLANNED_HISTORY_CHANGED');
      }
      if (current.errors.length || current.actions.some(action => !plan.actions.some(saved => JSON.stringify(saved) === JSON.stringify(action)))) throw Error('RECOVERY_PLAN_STALE');
      alreadyApplied = !current.actions.length;
    },
  });
  return { planHash, status: report.errors.length ? 'PARTIAL_REVIEW_REQUIRED' : alreadyApplied ? 'ALREADY_REPAIRED' : 'REPLAY_COMPLETED',
    plannedBars: plan.actions.length, ...report };
}

export async function reviewHistoryGaps(market, company, range, provider, {
  registry = createDefaultProviderRegistry(), sources = marketSources,
} = {}) {
  const { startDate, endDate } = range;
  const elapsed = Date.parse(endDate) - Date.parse(startDate);
  if (!validSessionDate(startDate) || !validSessionDate(endDate) || elapsed < 0 ||
      elapsed > 92 * 86_400_000 || endDate > market.latestClosed) throw Error('INVALID_GAP_REVIEW_WINDOW');
  if (identityEventAt(company.isin, endDate)) throw Error('GAP_REVIEW_LISTING_IDENTITY_RETIRED');
  if (company.issues.length || !company.gapWindowStart || startDate < company.gapWindowStart) {
    throw Error('UNVERIFIED_STORED_HISTORY_OR_LISTING_WINDOW');
  }
  const withBar = new Set(company.unverifiedWithBar);
  const requested = new Set([...company.missing, ...company.unverified]
    .filter(date => date >= startDate && date <= endDate && !withBar.has(date)));
  if (!requested.size) return { candidates: [], unresolved: [] };
  const route = providerRoute({ mic: company.mic }, { sourceRegistry: sources });
  if (!route.allowedProviderIds.includes(provider)) throw Error('UNAPPROVED_GAP_SOURCE');
  const permission = sources.markets[market.mic]?.publication?.[provider];
  if (permission?.free !== true || permission.publicArchive !== true || permission.publicDisplay !== true ||
      !permission.evidenceUrl?.startsWith('https://')) throw Error('UNVERIFIED_GAP_SOURCE_RIGHTS');
  const dates = [...requested].sort();
  const request = { startDate: dates[0], endDate: dates.at(-1), verifyIdentity: true };
  const { result } = await registry.fetchDaily({
    isin: company.isin, officialIsin: company.isin, mic: company.mic,
    symbol: company.symbol, currency: company.currency,
  }, request, provider, { strictPreferred: true, allowedProviderIds: [provider], timeoutMs: 25000 });
  const meta = result.providerMeta;
  if (meta?.isin !== company.isin || meta.mic !== company.mic || meta.currency !== company.currency ||
      meta.priceBasis !== 'UNADJUSTED' || meta.partialHistory === true || !result.requestUrl?.startsWith('https://')) {
    throw Error('UNVERIFIED_GAP_SOURCE_IDENTITY_OR_PRICE_BASIS');
  }
  const checked = inspectDailyBarIntegrity(result, request);
  const found = checked.bars.filter(bar => requested.has(bar.date));
  for (const bar of found) requested.delete(bar.date);
  return { candidates: found.map(bar => ({ bar, provider, sourceUrl: result.requestUrl, priceBasis: meta.priceBasis })),
    unresolved: [...requested].sort(), conflicts: checked.conflicts.filter(row => requested.has(row.date)) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv[2] === 'stored-plan') {
    const plan = await planStoredHistoryRecovery();
    const output = process.argv[3];
    if (!output) throw Error('RECOVERY_PLAN_OUTPUT_REQUIRED');
    await fs.writeFile(output, JSON.stringify(plan, null, 2) + '\n');
    console.log(JSON.stringify({ planHash: plan.planHash, bars: plan.actions.length, conflicts: plan.conflicts.length, errors: plan.errors.length }));
    process.exit(0);
  }
  if (process.argv[2] === 'stored-apply') {
    const plan = JSON.parse(await fs.readFile(process.argv[3], 'utf8'));
    console.log(JSON.stringify(await applyStoredHistoryRecovery(plan)));
    process.exit(0);
  }
  const [mic, isin, startDate, endDate, provider] = process.argv.slice(2);
  const report = await operationsReport();
  const market = report.markets.find(row => row.mic === mic);
  const company = market?.companies.find(row => row.isin === isin);
  if (!company) throw Error('ONBEKENDE_GOEDGEKEURDE_NOTERING');
  const proposed = await reviewHistoryGaps(market, company, { startDate, endDate }, provider);
  console.log(JSON.stringify({ market: mic, isin, ...proposed }, null, 2));
}
