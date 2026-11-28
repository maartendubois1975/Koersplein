import fs from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { approvedCompanyUniverse } from './company-register.mjs';
import { latestClosedSession } from './trading-calendar.mjs';
import { listingIdentity } from '../../daily-session-view.mjs';
import { manifestResolver } from '../../market-week-core.mjs';
import { validateHistoryDocument } from '../../chart.js';
import { inspectDailyBarIntegrity } from '../cloudflare/europe-run-policy.mjs';
import { appendHistoryDocument, writeArchiveDocument } from '../cloudflare/archive-approved-session.mjs';
import { withArchiveWriter } from './archive-writer-lock.mjs';

const hash = raw => createHash('sha256').update(raw).digest('hex');
const optional = async file => { try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; } };

// Reuse the owner's existing retained store, never a newly licensed provider.
// Original source bytes remain in the immutable proof, including excluded rows.
export async function reviewRetainedHistory(review, { dataDir = 'data', root = '.', now = new Date() } = {}) {
  if (review.schemaVersion !== 1 || review.scope !== 'EXISTING_APPROVED_STORE_ONLY' || !Array.isArray(review.companies) ||
      !Number.isFinite(Date.parse(review.observedAt)) || new Date(review.observedAt) > now) throw Error('INVALID_RETAINED_REVIEW');
  const raw = await fs.readFile(resolve(root, review.evidenceFile));
  if (hash(raw) !== review.evidenceSha256) throw Error('RETAINED_EVIDENCE_CHANGED');
  const proof = JSON.parse(gunzipSync(raw)), manifest = JSON.parse(proof.manifestRaw);
  if (hash(proof.manifestRaw) !== review.manifestSha256) throw Error('RETAINED_MANIFEST_CHANGED');
  const catalog = (await approvedCompanyUniverse()).find(row => row.mic === review.market);
  if (!catalog) throw Error('RETAINED_MARKET_NOT_ADMITTED');
  const companies = [], writes = [], seen = new Set();
  for (const selected of review.companies) {
    if (seen.has(selected.isin)) throw Error('DUPLICATE_RETAINED_REVIEW'); seen.add(selected.isin);
    const share = catalog.shares.find(row => row.isin === selected.isin);
    if (!share) throw Error('RETAINED_LISTING_NOT_APPROVED');
    const identity = listingIdentity(share, catalog.mic), currency = share.currency || catalog.currency || 'EUR';
    const storageId = manifestResolver(manifest, identity.mic)({ ...share, ...identity });
    if (!storageId) { companies.push({ ...identity, status: 'NO_RETAINED_MANIFEST_IDENTITY', completeOhlcv: 0 }); continue; }
    const source = proof.documents.find(row => row.storageId === storageId);
    if (!source || source.url !== 'https://koersplein.maarten-dubois1975.workers.dev/api/history/' + storageId || hash(source.raw) !== source.sha256) throw Error('RETAINED_SOURCE_CHANGED');
    const doc = JSON.parse(source.raw); doc.coverage.records ??= doc.coverage.recordCount;
    const rows = validateHistoryDocument(doc, { ...identity, isin: storageId });
    if (doc.instrument.currency !== currency || rows.at(-1).date > latestClosedSession(catalog.mic, now)) throw Error('RETAINED_CURRENCY_OR_DATE_MISMATCH');
    const checked = inspectDailyBarIntegrity(doc, { startDate: rows[0].date, endDate: rows.at(-1).date });
    const latest = await optional(join(dataDir, 'daily-session-' + catalog.mic + '.json'));
    const state = latest?.results.find(row => row.isin === identity.isin && row.mic === identity.mic);
    if (state?.evidence?.lastTradeDate && checked.bars.some(bar => bar.date > state.evidence.lastTradeDate)) throw Error('RETAINED_LAST_EXECUTED_DATE_CONFLICT');
    const summary = { ...identity, currency, sourceUrl: source.url, sourceSha256: source.sha256,
      rawRecords: rows.length, completeOhlcv: checked.bars.length,
      zeroVolumeRows: doc.bars.filter(bar => bar.volume === 0).length,
      excludedRows: rows.length - checked.bars.length, sourceConflicts: checked.conflicts.length,
      firstCompleteDate: checked.bars[0]?.date ?? null, lastCompleteDate: checked.bars.at(-1)?.date ?? null };
    if (!checked.bars.length) { companies.push({ ...summary, status: 'NO_COMPLETE_RETAINED_TRADES' }); continue; }
    const file = join(dataDir, 'history', identity.storageKey + '.json'), prior = await optional(file);
    if (prior) validateHistoryDocument(prior, identity);
    const provider = { name: 'retained-approved-archive', role: 'reviewed-retained-history',
      metadata: { originalProvider: doc.provider?.name ?? doc.provider?.id ?? null,
        originalRetrievedAt: doc.provider?.retrievedAt ?? null, retainedObservedAt: review.observedAt,
        sourceUrl: source.url, sourceSha256: source.sha256, evidenceSha256: review.evidenceSha256,
        priceBasis: 'UNVERIFIED', completenessEvidenceVerified: false, backfillComplete: false },
      licenseNote: doc.provider?.licenseNote ?? 'Retained source; no new redistribution entitlement inferred.' };
    const prepared = appendHistoryDocument(prior, identity, currency, checked.bars, { provider });
    if (prepared.conflicts.length) throw Error('RETAINED_EXISTING_HISTORY_CONFLICT');
    // The reviewed scope was missing local documents. A concurrent new document
    // may be reused only when it already contains every reviewed observation.
    if (prior && prepared.added) throw Error('RETAINED_TARGET_CHANGED');
    if (!prior) writes.push({ file, document: prepared.document });
    companies.push({ ...summary, status: prior ? 'ALREADY_RETAINED' : 'READY_TO_RESTORE' });
  }
  return { companies, writes };
}

export async function restoreRetainedHistory(review, options = {}) {
  const dataDir = options.dataDir ?? 'data';
  return withArchiveWriter(dataDir, async () => {
    const plan = await reviewRetainedHistory(review, options);
    for (const row of plan.writes) await writeArchiveDocument(row.file, row.document);
    return { schemaVersion: 1, performedAt: new Date().toISOString(), market: review.market,
      evidenceFile: review.evidenceFile, evidenceSha256: review.evidenceSha256,
      restoredCompanies: plan.writes.length,
      restoredBars: plan.writes.reduce((n, row) => n + row.document.bars.length, 0),
      companies: plan.companies.map(row => ({ ...row, status: row.status === 'READY_TO_RESTORE' ? 'RESTORED_RETAINED_TRADES' : row.status })),
      networkRequestsDuringApply: 0, newSourceRightsGranted: false };
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv[3] || process.argv[3].startsWith('--')) throw Error('RETAINED_REPORT_PATH_REQUIRED');
  const review = JSON.parse(await fs.readFile(process.argv[2], 'utf8'));
  const report = process.argv.includes('--apply') ? await restoreRetainedHistory(review) : await reviewRetainedHistory(review);
  await writeArchiveDocument(process.argv[3], report);
  console.log(JSON.stringify({ restoredCompanies: report.restoredCompanies, restoredBars: report.restoredBars,
    companies: report.companies.length, dryRun: !process.argv.includes('--apply') }));
}
