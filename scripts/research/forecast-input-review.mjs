import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import { join } from 'node:path';
import { listingIdentity, validSessionDate } from '../../daily-session-view.mjs';
import { sessionCalendar } from '../history/trading-calendar.mjs';
import { inspectDailyBarIntegrity } from '../cloudflare/europe-run-policy.mjs';
import { assessPeriod } from './amsterdam-period-quality.mjs';
import { loadApprovedHistory } from './market-history-source.mjs';

export const forecastLookback = 253;

export const forecastWindowHash = bars => createHash('sha256').update(JSON.stringify(bars.map(bar =>
  [bar.date, bar.open, bar.high, bar.low, bar.close, bar.volume]))).digest('hex');

export function reviewedForecastWindow(bars, review, identity, cutoff) {
  const instrument = review?.instrument;
  const expectedUrl = 'https://live.euronext.com/en/ajax/getHistoricalPricePopup/' + identity.isin + '-' + identity.mic;
  const validHash = value => /^[a-f0-9]{64}$/.test(value || '');
  if (!instrument || instrument.isin !== identity.isin || instrument.mic !== identity.mic ||
      instrument.symbol !== identity.symbol || instrument.currency !== identity.currency ||
      review.asOf !== cutoff || !validSessionDate(review.firstDate) || review.firstDate > cutoff ||
      review.records !== forecastLookback || review.priceBasis !== 'UNADJUSTED' ||
      review.source?.provider !== 'euronext-live' || review.source.url !== expectedUrl ||
      review.source.adjusted !== 'N' || review.source.adjustmentComparison !== 'N_EQUALS_Y' ||
      !validHash(review.source.rawResponseSha256) || !validHash(review.source.adjustedResponseSha256) ||
      !validHash(review.source.quoteSha256) || !validHash(review.officialWindowSha256) ||
      !validHash(review.corporateActions?.sourceSha256) ||
      review.corporateActions?.sourceUrl !== expectedUrl.replace('getHistoricalPricePopup/', 'getNoticePublicData/') + '?alias=1&pageNum=1&pageSize=50' ||
      review.corporateActions.review !== 'NO_SPLIT_OR_RIGHTS_ADJUSTMENT_OBSERVED_IN_253_SESSION_WINDOW') {
    throw Error('FORECAST_WINDOW_REVIEW_IDENTITY_OR_SOURCE_MISMATCH');
  }
  const selected = bars.filter(bar => bar.date >= review.firstDate && bar.date <= cutoff);
  if (selected.length !== forecastLookback || forecastWindowHash(selected) !== review.rawWindowSha256) {
    throw Error('FORECAST_WINDOW_ARCHIVED_OBSERVATION_CHANGED');
  }
  const expectedDates = [];
  const cursor = new Date(review.firstDate + 'T12:00:00Z');
  while (cursor.toISOString().slice(0, 10) <= cutoff) {
    const date = cursor.toISOString().slice(0, 10);
    if (sessionCalendar(identity.mic, date).open) expectedDates.push(date);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  if (JSON.stringify(expectedDates) !== JSON.stringify(selected.map(bar => bar.date))) {
    throw Error('FORECAST_WINDOW_OPEN_SESSION_MISSING');
  }
  const byDate = new Map(selected.map(bar => [bar.date, bar]));
  for (const resolution of review.resolutions || []) {
    const original = byDate.get(resolution.date);
    if (!original || resolution.selection !== 'OFFICIAL_UNADJUSTED' ||
        !Array.isArray(resolution.fields) || !resolution.fields.length ||
        resolution.fields.some(field => !['high', 'low'].includes(field)) ||
        forecastWindowHash([original]) !== forecastWindowHash([resolution.base]) ||
        resolution.official?.date !== resolution.date) throw Error('FORECAST_WINDOW_RESOLUTION_MISMATCH');
    const replacement = { ...original };
    for (const field of resolution.fields) replacement[field] = resolution.official[field];
    byDate.set(resolution.date, replacement);
  }
  const modelBars = [...byDate.values()];
  const checked = inspectDailyBarIntegrity({ bars: modelBars }, { startDate: review.firstDate, endDate: cutoff });
  if (checked.conflicts.length || checked.bars.length !== forecastLookback ||
      forecastWindowHash(modelBars) !== review.modelWindowSha256) throw Error('FORECAST_WINDOW_REVIEWED_VALUES_CHANGED');
  return modelBars;
}

export async function loadForecastHistory(share, mic, options) {
  try {
    return await loadApprovedHistory(share, mic, { ...options, requirePredictionEvidence: true });
  } catch (error) {
    if (!error.message.startsWith('PREDICTION_SOURCE_PROVENANCE_UNVERIFIED')) throw error;
    let reviews;
    try { reviews = JSON.parse(await fs.readFile(join(options?.dataDir || 'data', 'forecast-input-reviews.json'), 'utf8')); }
    catch (reviewError) { if (reviewError.code === 'ENOENT') throw error; throw reviewError; }
    const identity = { ...listingIdentity(share, mic, options.cutoff), currency: options.currency || share.currency || 'EUR' };
    const review = reviews.schemaVersion === 1 && reviews.instruments?.[identity.storageKey];
    if (!review || review.asOf !== options.cutoff) throw error;
    const bars = await loadApprovedHistory(share, mic, options);
    return reviewedForecastWindow(bars, review, identity, options.cutoff);
  }
}

export function assessForecastWindow(bars, cutoff) {
  const lastDate = bars.at(-1)?.date ?? null;
  if (lastDate !== cutoff) return { status: 'STALE_HISTORY', lastDate };
  if (bars.length < forecastLookback) return { status: 'INSUFFICIENT_HISTORY', records: bars.length };
  const window = bars.slice(-forecastLookback);
  const { issues } = assessPeriod(window);
  if (issues.length) return { status: 'HISTORY_QUALITY_BLOCKED', issues };
  return { status: 'READY',
    windowSha256: forecastWindowHash(window) };
}

export async function auditStoredForecastInput(share, mic, options) {
  let bars;
  try {
    bars = await loadForecastHistory(share, mic, options);
  } catch (error) {
    if (!error.message.startsWith('PREDICTION_SOURCE_PROVENANCE_UNVERIFIED')) {
      return { status: error.message.split(' ')[0] };
    }
    try {
      const stored = await loadApprovedHistory(share, mic, options);
      const window = assessForecastWindow(stored, options.cutoff);
      return { status: 'PROVENANCE_UNVERIFIED', storedWindowStatus: window.status };
    } catch (structuralError) {
      return { status: 'PROVENANCE_UNVERIFIED', storedWindowStatus: structuralError.message.split(' ')[0] };
    }
  }
  return assessForecastWindow(bars, options.cutoff);
}
