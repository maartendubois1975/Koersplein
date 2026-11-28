import fs from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { parentMic } from '../history/market-definitions.mjs';
import { listingIdentity } from '../../daily-session-view.mjs';
import { approvedCompanyUniverse } from '../history/company-register.mjs';
import { latestClosedSession } from '../history/trading-calendar.mjs';
import { mapConcurrent } from '../cloudflare/europe-run-policy.mjs';
import { loadForecastHistory } from './forecast-input-review.mjs';
import { loadApprovedHistory } from './market-history-source.mjs';
import { resolveForecastReview, deriveForecastRollforward, rollingKey, forecastReviewHash } from './forecast-rollforward.mjs';
import { parseForecastNotices, parseForecastNoticePages } from './forecast-source-audit.mjs';
import { euronextHistoricalSnapshot, euronextQuoteSnapshot, decodeEuronextBody } from '../history/providers/euronext-live.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export async function fetchForecastSourceEvidence(instrument, cutoff, firstDate) {
  const n = await euronextHistoricalSnapshot(instrument, { startDate: firstDate, endDate: cutoff, adjusted: 'N' }, AbortSignal.timeout(30000));
  const y = await euronextHistoricalSnapshot(instrument, { startDate: firstDate, endDate: cutoff, adjusted: 'Y' }, AbortSignal.timeout(30000));
  const quote = await euronextQuoteSnapshot(instrument, AbortSignal.timeout(30000));
  const pages = [], pageHashes = [];
  const root = 'https://live.euronext.com/en/ajax/getNoticePublicData/' + instrument.isin + '-' + instrument.mic;
  let total = 0;
  for (let page = 1; page === 1 || pages.length * 50 < total; page++) {
    if (page > 10) throw Error('FORECAST_NOTICE_PAGINATION_LIMIT');
    const url = root + '?alias=1&pageNum=' + page + '&pageSize=50';
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw Error('FORECAST_NOTICE_HTTP_' + response.status);
    const raw = await response.text(), html = decodeEuronextBody(raw);
    const parsed = parseForecastNotices(html);
    if (parsed.total == null) throw Error('FORECAST_NOTICE_COUNT_ABSENT');
    if (page === 1) total = parsed.total;
    pages.push({ html }); pageHashes.push({ page, url, sha256: hash(raw) });
  }
  const within = rows => rows.filter(row => row.date >= firstDate && row.date <= cutoff).sort((a, b) => a.date.localeCompare(b.date));
  return { instrument, cutoff, rawRows: within(n.rows), adjustedRows: within(y.rows), quote,
    notices: parseForecastNoticePages(pages), source: { provider: 'euronext-live', url: n.sourceUrl,
      rawResponseSha256: n.sourceSha256, adjustedResponseSha256: y.sourceSha256, quoteSha256: quote.sourceSha256,
      noticeSha256: hash(JSON.stringify(pageHashes)), noticePages: pageHashes, retrievedAt: new Date().toISOString() } };
}

async function putImmutable(file, bytes) {
  await fs.mkdir(join(file, '..'), { recursive: true });
  try { await fs.writeFile(file, bytes, { flag: 'wx' }); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    if (!(await fs.readFile(file)).equals(bytes)) throw Error('FORECAST_SOURCE_EVIDENCE_CHANGED');
  }
}

export async function refreshForecastInputReviews({ dataDir = 'data', cutoff, clock = () => new Date(),
  fetchEvidence = fetchForecastSourceEvidence, catalogs, concurrency = 2 } = {}) {
  const file = join(dataDir, 'forecast-input-reviews.json');
  const original = await fs.readFile(file, 'utf8'), manifest = JSON.parse(original);
  if (manifest.schemaVersion !== 1 || !manifest.instruments) throw Error('FORECAST_REVIEW_MANIFEST_INVALID');
  catalogs ??= await approvedCompanyUniverse();
  const report = { schemaVersion: 1, cutoff, startedAt: clock().toISOString(), results: [] }, additions = [], evidenceRows = [];
  await mapConcurrent(Object.entries(manifest.instruments), concurrency, async ([key, base]) => {
    try {
      const catalog = catalogs.find(row => row.mic === parentMic(base.instrument.mic));
      const share = catalog?.shares.find(row => row.isin === base.instrument.isin && row.symbol === base.instrument.symbol);
      if (!share || listingIdentity(share, catalog.mic, cutoff).storageKey !== key || (share.currency || catalog.currency || 'EUR') !== base.instrument.currency) throw Error('FORECAST_SEED_OUTSIDE_APPROVED_REGISTER');
      if (cutoff !== latestClosedSession(catalog.mic, clock())) throw Error('FORECAST_REFRESH_REQUIRES_LATEST_CLOSED_SESSION');
      const existing = resolveForecastReview(manifest, key, cutoff);
      if (existing) {
        await loadForecastHistory(share, catalog.mic, { dataDir, cutoff, currency: base.instrument.currency });
        report.results.push({ key, status: 'ALREADY_REVIEWED' }); return;
      }
      const previousDates = [base.asOf, ...Object.values(manifest.rollforwards || {})
        .filter(row => row.review.instrument.mic + ':' + row.review.instrument.isin === key).map(row => row.review.asOf)]
        .filter(date => date < cutoff).sort();
      const prior = resolveForecastReview(manifest, key, previousDates.at(-1))?.review;
      if (!prior) throw Error('FORECAST_PREVIOUS_REVIEW_ABSENT');
      const bars = await loadApprovedHistory(share, catalog.mic, { dataDir, cutoff, currency: base.instrument.currency });
      const firstDate = bars.at(-253)?.date;
      if (!firstDate || bars.at(-1)?.date !== cutoff) throw Error('FORECAST_ARCHIVE_NOT_READY');
      const evidence = await fetchEvidence(base.instrument, cutoff, firstDate);
      const entry = deriveForecastRollforward(bars, prior, evidence, clock());
      additions.push({ key, entry }); evidenceRows.push({ key, reviewSha256: entry.reviewSha256, evidence });
      report.results.push({ key, status: 'VERIFIED_ROLLFORWARD', prior: prior.asOf, overlap: entry.verifiedOverlap });
    } catch (error) { report.results.push({ key, status: 'REVIEW_UNCONFIRMED', reason: error.message }); }
  });
  if (additions.length) {
    // One immutable content-addressed batch. Retries can add a later batch without replacing earlier proof.
    evidenceRows.sort((a, b) => a.key.localeCompare(b.key));
    const bytes = gzipSync(JSON.stringify(evidenceRows));
    const sha256 = hash(bytes), relative = 'forecast-input-evidence/' + sha256 + '.json.gz';
    await putImmutable(join(dataDir, relative), bytes);
    manifest.rollforwards ??= {};
    for (const { key, entry } of additions) {
      const id = rollingKey(key, cutoff);
      if (manifest.rollforwards[id]) throw Error('FORECAST_ROLLFORWARD_ALREADY_SAVED');
      manifest.rollforwards[id] = { ...entry, evidence: { file: relative, sha256 } };
    }
    // Exclusive writer plus compare-and-swap, preserving every earlier admission.
    const lock = await fs.open(file + '.lock', 'wx');
    try {
    if (await fs.readFile(file, 'utf8') !== original) throw Error('FORECAST_MANIFEST_CONCURRENT_CHANGE');
    if (JSON.stringify(manifest.instruments) !== JSON.stringify(JSON.parse(original).instruments)) throw Error('FORECAST_SEED_CHANGED');
    for (const [id, entry] of Object.entries(JSON.parse(original).rollforwards || {})) {
      if (forecastReviewHash(manifest.rollforwards[id]) !== forecastReviewHash(entry)) throw Error('FORECAST_ROLLING_HISTORY_CHANGED');
    }
    await fs.writeFile(file + '.tmp', JSON.stringify(manifest, null, 2) + '\n');
    await fs.rename(file + '.tmp', file);
    } finally { await lock.close(); await fs.unlink(file + '.lock'); }
  }
  report.results.sort((a, b) => a.key.localeCompare(b.key));
  report.finishedAt = clock().toISOString();
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cutoff = process.env.TARGET_SESSION || latestClosedSession('XAMS');
  const report = await refreshForecastInputReviews({ cutoff });
  await fs.mkdir('research/output', { recursive: true });
  await fs.writeFile('research/output/forecast-input-refresh.json', JSON.stringify(report, null, 2) + '\n');
  await fs.writeFile('data/forecast-input-refresh-status.json.tmp', JSON.stringify(report, null, 2) + '\n');
  await fs.rename('data/forecast-input-refresh-status.json.tmp', 'data/forecast-input-refresh-status.json');
  console.log(JSON.stringify({ cutoff, reviewed: report.results.filter(row => row.status === 'VERIFIED_ROLLFORWARD').length,
    cached: report.results.filter(row => row.status === 'ALREADY_REVIEWED').length,
    unconfirmed: report.results.filter(row => row.status === 'REVIEW_UNCONFIRMED').length }));
}
