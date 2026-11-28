import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { historyAvailability, listingIdentity, validSessionDate, sessionSnapshotAt } from '../../daily-session-view.mjs';
import { validateHistoryDocument } from '../../chart.js';
import { validateSnapshot } from '../cloudflare/archive-approved-session.mjs';
import { inspectDailyBarIntegrity, mapConcurrent } from '../cloudflare/europe-run-policy.mjs';
import { approvedCompanyUniverse, companyContracts, validateCompanyCatalog } from './company-register.mjs';
import { operationalMarketIssues } from './market-definitions.mjs';
import { providerRoute } from './source-policy.mjs';
import { latestClosedSession, sessionCalendar, tradingCalendars } from './trading-calendar.mjs';
import { auditStoredForecastInput } from '../research/forecast-input-review.mjs';
import { verifyOpportunity, opportunityScoreboard } from '../research/prediction-ledger-core.mjs';
import { historyCoverage } from './history-coverage.mjs';
import { marketSources } from './market-definitions.mjs';

async function json(file) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function openDates(mic, through) {
  const calendar = tradingCalendars.calendars[tradingCalendars.markets[mic]];
  const sessions = [];
  for (const year of Object.keys(calendar.years).sort()) {
    const cursor = new Date(year + '-01-01T00:00:00Z');
    while (String(cursor.getUTCFullYear()) === year) {
      const date = cursor.toISOString().slice(0, 10);
      if (date > through) return sessions;
      if (sessionCalendar(mic, date).open) sessions.push(date);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  return sessions;
}

async function inspectHistory(file, identity, currency, cutoff) {
  if (!file) return null;
  const doc = await json(file);
  if (!doc) return null;
  if (doc.instrument?.currency !== currency) throw Error('HISTORY_CURRENCY_MISMATCH');
  const rows = validateHistoryDocument(doc, identity);
  if (doc.coverage.lastDate > cutoff) throw Error('HISTORY_AFTER_LATEST_CLOSED_SESSION');
  const { bars } = inspectDailyBarIntegrity({ bars: doc.bars }, { startDate: rows[0].date, endDate: cutoff });
  const good = new Set(bars.map(bar => bar.date));
  return { bars, rows, invalidDates: rows.filter(bar => !good.has(bar.date)).map(bar => bar.date), audit: {
    source: doc.provider?.id || doc.provider?.name || null,
    firstDate: rows[0].date, lastDate: rows.at(-1).date,
    completeBars: bars.length, incompleteBars: rows.length - bars.length,
    priceBasis: doc.provider?.metadata?.adjustmentStatus ?? null,
    completenessVerified: doc.coverage.backfillComplete === true &&
      doc.provider?.metadata?.completenessEvidenceVerified === true,
  } };
}

async function reportMarket(catalog, dataDir, now, availability, reviews) {
  const { mic, shares } = catalog;
  const closed = latestClosedSession(mic, now);
  const sessions = openDates(mic, closed);
  const archived = new Map();
  const readErrors = [];
  const archiveDir = join(dataDir, 'daily-sessions', mic);
  const files = await fs.readdir(archiveDir).catch(error => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  for (const name of files.sort()) {
    const date = name.slice(0, -5);
    if (!name.endsWith('.json') || !validSessionDate(date) || date > closed) continue;
    try {
      const snapshot = sessionSnapshotAt(validateSnapshot(await json(join(archiveDir, name)), catalog, mic), now);
      if (snapshot.session !== date || !sessionCalendar(mic, date).open) throw Error('INVALID_ARCHIVE_SESSION');
      archived.set(date, new Map(snapshot.results.map(row => [row.isin, row])));
    } catch (error) { readErrors.push({ date, reason: error.message }); }
  }
  let latest = null;
  try {
    const snapshot = await json(join(dataDir, 'daily-session-' + mic + '.json'));
    if (snapshot) {
      if (!archived.has(snapshot.session)) throw Error('PUBLISHED_ARCHIVE_SESSION_MISSING');
      latest = sessionSnapshotAt(validateSnapshot(snapshot, catalog, mic), now);
    }
  } catch (error) { readErrors.push({ reason: error.message }); }

  const companies = [];
  const forecastCounts = {}, forecastWindows = {};
  await mapConcurrent(shares, 8, async (share, index) => {
    const identity = listingIdentity(share, mic, closed);
    const currency = share.currency || catalog.currency || 'EUR';
    const issues = [];
    async function readHistory(file, kind) {
      try { return await inspectHistory(file, identity, currency, closed); }
      catch (error) { issues.push({ kind, reason: error.message }); return null; }
    }
    const archive = await readHistory(join(dataDir, 'history', identity.storageKey + '.json'), 'archive');
    const legacy = await readHistory(join(dataDir, mic === 'XAMS' ? 'history' : 'test-history',
      (mic === 'XAMS' ? identity.isin : identity.storageKey) + '.json'), 'legacy');
    const bars = new Set([...(archive?.rows || []), ...(legacy?.rows || [])].map(bar => bar.date));
    const statuses = new Map([...archived].flatMap(([date, rows]) => rows.has(identity.isin) ? [[date, rows.get(identity.isin)]] : []));
    const listingDate = share.currentListing?.isin === identity.isin
      ? share.currentListing.effectiveDate : share.listingDate;
    const observed = [...bars, ...statuses.keys()].sort();
    const start = validSessionDate(listingDate) ? listingDate : observed[0];
    const coverage = historyCoverage({ archive, legacy, identity, statuses, sessions, start, cutoff: closed,
      review: reviews?.instruments?.[identity.storageKey] });
    if (latest) {
      const review = await auditStoredForecastInput(share, mic, { dataDir, cutoff: latest.session, currency });
      forecastCounts[review.status] = (forecastCounts[review.status] ?? 0) + 1;
      if (review.storedWindowStatus) {
        forecastWindows[review.storedWindowStatus] = (forecastWindows[review.storedWindowStatus] ?? 0) + 1;
      }
    }
    companies[index] = { ...identity, currency, firstDate: [archive?.audit.firstDate, legacy?.audit.firstDate].filter(Boolean).sort()[0] ?? null,
      lastDate: [archive?.audit.lastDate, legacy?.audit.lastDate].filter(Boolean).sort().at(-1) ?? null,
      archive: archive?.audit ?? null, legacy: legacy?.audit ?? null,
      availability: historyAvailability(availability, identity),
      gapWindowStart: start && sessions.find(date => date >= start) || null,
      listingDateVerified: validSessionDate(listingDate), ...coverage, issues };
  });
  const observedSources = latest ? [...new Set(latest.results.map(row => row.provider || row.evidence?.provider).filter(Boolean))].sort() : null;
  const counts = latest?.results.reduce((result, row) => {
    result[row.status] = (result[row.status] || 0) + 1;
    return result;
  }, {});
  const sources = providerRoute({ mic }, { mode: 'update' });
  return {
    mic, name: catalog.exchange || mic, approvedCompanies: shares.length,
    latestClosed: closed, latestArchived: [...archived.keys()].at(-1) ?? null,
    latestPublished: latest?.session ?? null, counts: counts ?? null,
    history: { archive: companies.filter(row => row.archive).length, legacy: companies.filter(row => row.legacy).length,
      any: companies.filter(row => row.archive || row.legacy).length,
      archiveBars: companies.reduce((total, row) => total + (row.archive?.completeBars ?? 0), 0),
      legacyBars: companies.reduce((total, row) => total + (row.legacy?.completeBars ?? 0), 0),
      ...Object.fromEntries(['completeUniqueDays', 'confirmedArchiveDays', 'reviewedSourceDays', 'assessedSessions',
        'coveredSessions', 'beforeCalendarDays'].map(key => [key, companies.reduce((n, row) => n + row.coverage[key], 0)])),
      sourceConflictDays: companies.reduce((n, row) => n + row.coverage.sourceConflicts.length, 0),
      statusConflictDays: companies.reduce((n, row) => n + row.coverage.statusConflicts.length, 0),
      incompleteDays: companies.reduce((n, row) => n + row.coverage.incompleteDates.length, 0),
      unknownStartCompanies: companies.filter(row => !row.listingDateVerified).length,
      missingSessions: companies.reduce((n, row) => n + row.missing.length, 0),
      unverifiedSessions: companies.reduce((n, row) => n + row.unverified.length, 0),
      noTradeSessions: companies.reduce((n, row) => n + row.noTrades.length, 0) },
    forecastReadiness: latest ? { session: latest.session, counts: forecastCounts, unverifiedWindows: forecastWindows } : null,
    sources: sources.allowedProviderIds, observedSources,
    historyRecovery: { mode: 'STORED_APPROVED_SESSION_REPLAY_ONLY',
      networkSources: providerRoute({ mic }).allowedProviderIds.map(provider => {
        const permission = marketSources.markets[mic]?.publication?.[provider];
        return { provider, newPublicArchiveAllowed: permission?.free === true && permission.publicArchive === true &&
          permission.publicDisplay === true && /^https:\/\//.test(permission.evidenceUrl ?? '') };
      }) },
    sourceErrors: latest?.results.filter(row => row.officialError || ['OFFICIAL_SOURCE_ERROR', 'PROVIDER_DATA_UNAVAILABLE'].includes(row.reasonCode))
      .map(row => ({ isin: row.isin, reason: row.officialError || row.error || row.reasonCode })) ?? null,
    archiveConflicts: latest?.archiveConflicts ?? null, recovery: latest?.recovery ?? null, readErrors, companies,
  };
}

export async function operationsReport({ dataDir = 'data', now = new Date(), commit = null, buildCheck = null } = {}) {
  const catalogs = await approvedCompanyUniverse();
  const markets = [];
  const storedAvailability = await json(join(dataDir, 'history-availability.json'));
  const availability = storedAvailability?.reviewedOn <= now.toISOString().slice(0, 10) ? storedAvailability : null;
  const reviews = await json(join(dataDir, 'history-chart-resolutions.json'));
  for (const catalog of catalogs) markets.push(await reportMarket(catalog, dataDir, now, availability, reviews));
  const ledger = await json(join(dataDir, 'opportunity-ledger.json'));
  const storedRefresh = await json(join(dataDir, 'forecast-input-refresh-status.json'));
  const storedRecovery = await json(join(dataDir, 'history-recovery-status.json'));
  const historyRecovery = storedRecovery?.schemaVersion === 1 && new Date(storedRecovery.performedAt) <= now
    ? storedRecovery : null;
  const retainedReview = await json(join(dataDir, 'retained-history-review.json'));
  const retainedHistoryReview = retainedReview?.schemaVersion === 1 && new Date(retainedReview.performedAt) <= now ? retainedReview : null;
  const sessionReview = await json(join(dataDir, 'session-evidence-review-status.json'));
  const sessionEvidenceReview = sessionReview?.schemaVersion === 1 && new Date(sessionReview.performedAt) <= now ? sessionReview : null;
  for (const market of markets) for (const company of market.companies) {
    const source = retainedHistoryReview?.companies.find(row => row.storageKey === company.storageKey);
    if (source) company.retainedReview = Object.fromEntries(['status', 'rawRecords', 'completeOhlcv', 'excludedRows', 'sourceSha256'].map(key => [key, source[key] ?? null]));
  }
  const archiveWriter = await json(join(dataDir, '.archive-writer-lock', 'owner.json'));
  const forecastSourceRefresh = storedRefresh?.schemaVersion === 1 && validSessionDate(storedRefresh.cutoff) &&
    Array.isArray(storedRefresh.results) && new Date(storedRefresh.finishedAt) <= now &&
    storedRefresh.cutoff <= latestClosedSession('XAMS', now) ? storedRefresh : null;
  const contracts = await json(new URL('../../data/company-register-contracts.json', import.meta.url));
  const previews = [];
  for (const [mic, contract] of Object.entries(contracts.catalogPreviews || {})) {
    const catalog = await json(join(dataDir, contract.file));
    const blockers = catalog ? operationalMarketIssues(catalog, contract) : ['CATALOG_UNAVAILABLE'];
    if (catalog) { try { validateCompanyCatalog(catalog, contract); }
      catch { blockers.push('CATALOG_IDENTITY_MISMATCH'); } }
    const counts = {};
    for (const issue of blockers) counts[issue.split(' ')[0]] = (counts[issue.split(' ')[0]] || 0) + 1;
    let sourceReview = null, sourceReviewError = null;
    if (contract.sourceReview) {
      try {
        const raw = await fs.readFile(join(dataDir, contract.sourceReview.file));
        if (createHash('sha256').update(raw).digest('hex') !== contract.sourceReview.sha256) throw Error('SOURCE_REVIEW_CHANGED');
        const evidence = JSON.parse(raw);
        if (evidence.approved !== catalog?.shares.length || !validSessionDate(evidence.session)) throw Error('SOURCE_REVIEW_IDENTITY_MISMATCH');
        sourceReview = Object.fromEntries(['session', 'approved', 'observed', 'volumeMatches', 'lastTradeMatches',
          'referenceCloseDifferences', 'definitionUnresolved', 'noTradeConfirmed', 'unconfirmed', 'issuerIdentities'].map(key => [key, evidence[key]]));
      } catch (error) { sourceReviewError = error.message; }
    }
    previews.push({ mic, companies: catalog?.shares?.length ?? null, expectedCompanies: contract.expectedCount,
      operational: blockers.length === 0, admissionBlockers: counts, sourceReview, sourceReviewError });
  }
  for (const row of ledger ?? []) if (row.recordHash) verifyOpportunity(row);
  return { schemaVersion: 1, generatedAt: now.toISOString(), commit, buildCheck, markets, previews, forecastSourceRefresh,
    historyRecovery, archiveWriter, retainedHistoryReview, sessionEvidenceReview,
    predictions: ledger && opportunityScoreboard(ledger, Object.keys(companyContracts)),
    predictionRecords: (ledger ?? []).filter(row => row.recordHash && !row.legacyUnverified).map(row => ({
      ...Object.fromEntries(['market', 'name', 'isin', 'ticker', 'recordHash', 'createdAt', 'referenceDate',
        'referenceClose', 'currency', 'signalType', 'horizonMonths', 'targetPct', 'status', 'latestDate',
        'latestClose', 'currentReturn', 'benchmarkReturn', 'evaluationError', 'endDate', 'result30'].map(key => [key, row[key] ?? null])),
      benchmarkMembers: row.benchmarkAtSelection?.length ?? 0,
    })) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const output = process.argv[2];
  if (!output) throw Error('Geef het uitvoerpad voor het statusrapport.');
  const commit = process.env.RENDER_GIT_COMMIT || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const report = await operationsReport({ commit, buildCheck: process.argv.includes('--history-tested') ? 'HISTORY_TEST_PASSED' : null });
  await fs.writeFile(output + '.tmp', JSON.stringify(report));
  await fs.rename(output + '.tmp', output);
}
