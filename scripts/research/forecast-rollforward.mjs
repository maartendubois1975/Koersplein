import { createHash } from 'node:crypto';
import { sameSourcePrice } from '../../chart.js';
import { sessionCalendar, latestClosedSession } from '../history/trading-calendar.mjs';
import { proposeForecastReview } from './forecast-source-audit.mjs';
import { reviewedForecastWindow, assessForecastWindow } from './forecast-input-review.mjs';

const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
export const forecastReviewHash = review => createHash('sha256').update(JSON.stringify(canonical(review))).digest('hex');
export const rollingKey = (identity, date) => identity + '@' + date;

export function resolveForecastReview(manifest, identity, date) {
  const base = manifest.instruments?.[identity];
  if (!base) return null;
  if (base.asOf === date) return { review: base, entry: null };
  const first = manifest.rollforwards?.[rollingKey(identity, date)];
  if (!first) return null;
  if (first.review?.asOf !== date) throw Error('FORECAST_ROLLING_CHAIN_INVALID');
  let current = first, visited = new Set();
  while (current) {
    const key = rollingKey(identity, current.review?.asOf);
    if (visited.has(key) || visited.size > 10000 ||
        current.reviewSha256 !== forecastReviewHash(current.review) ||
        current.review.instrument.mic + ':' + current.review.instrument.isin !== identity ||
        !current.parent || current.parent.asOf >= current.review.asOf) throw Error('FORECAST_ROLLING_CHAIN_INVALID');
    visited.add(key);
    const prior = base.asOf === current.parent.asOf ? base : manifest.rollforwards?.[rollingKey(identity, current.parent.asOf)]?.review;
    if (!prior || forecastReviewHash(prior) !== current.parent.sha256) throw Error('FORECAST_ROLLING_PARENT_CHANGED');
    if (prior === base) break;
    current = manifest.rollforwards[rollingKey(identity, prior.asOf)];
  }
  return { review: first.review, entry: first };
}

export function deriveForecastRollforward(bars, priorReview, evidence, now = new Date()) {
  const { instrument, cutoff } = evidence;
  if (cutoff !== latestClosedSession(instrument.mic, now) || !sessionCalendar(instrument.mic, cutoff).open ||
      priorReview.asOf >= cutoff) throw Error('FORECAST_ROLLING_NOT_NEW_CLOSED_SESSION');
  const sourceTime = new Date(evidence.source.retrievedAt);
  if (!Number.isFinite(sourceTime.getTime()) || sourceTime > now || latestClosedSession(instrument.mic, sourceTime) !== cutoff) {
    throw Error('FORECAST_ROLLING_SOURCE_NOT_FRESH');
  }
  if (!evidence.quote.lastTradeDate || evidence.quote.lastTradeDate < cutoff ||
      evidence.quote.identityUnknown || evidence.quote.tradingState === 'SUSPENDED') throw Error('FORECAST_ROLLING_QUOTE_NOT_CONFIRMED');
  const cursor = new Date(priorReview.asOf + 'T12:00:00Z');
  let sessions = 0;
  for (cursor.setUTCDate(cursor.getUTCDate() + 1); cursor.toISOString().slice(0, 10) <= cutoff; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    if (sessionCalendar(instrument.mic, cursor.toISOString().slice(0, 10)).open) sessions++;
    if (sessions > 10) throw Error('FORECAST_ROLLING_REVIEW_TOO_OLD');
  }
  if (!sessions || evidence.rawRows.some(row => row.date > cutoff) || evidence.adjustedRows.some(row => row.date > cutoff)) {
    throw Error('FORECAST_ROLLING_FUTURE_SOURCE');
  }
  const parentWindow = reviewedForecastWindow(bars, priorReview, instrument, priorReview.asOf);
  const result = proposeForecastReview(bars, evidence, { priorReview });
  if (result.status !== 'REVIEW_PROPOSAL') throw Error('FORECAST_ROLLING_SOURCE_BLOCKED ' + result.issues.join(','));
  const review = result.proposal;
  const priorByDate = new Map(parentWindow.map(row => [row.date, row]));
  let overlap = 0;
  for (const official of evidence.rawRows.filter(row => row.date >= review.firstDate && row.date <= priorReview.asOf)) {
    const prior = priorByDate.get(official.date);
    if (!prior || prior.volume !== official.volume || ['open', 'high', 'low', 'close'].some(field => !sameSourcePrice(prior[field], official[field]))) {
      throw Error('FORECAST_ROLLING_OVERLAP_CHANGED ' + official.date);
    }
    overlap++;
  }
  if (overlap !== 253 - sessions) throw Error('FORECAST_ROLLING_OVERLAP_INCOMPLETE');
  for (const resolution of review.resolutions) {
    const old = priorReview.resolutions.find(row => row.date === resolution.date);
    if (!old || JSON.stringify(old.fields) !== JSON.stringify(resolution.fields) ||
        resolution.fields.some(field => old.official[field] !== resolution.official[field])) {
      throw Error('FORECAST_ROLLING_NEW_CORRECTION_REQUIRES_REVIEW');
    }
  }
  if (assessForecastWindow(reviewedForecastWindow(bars, review, instrument, cutoff), cutoff).status !== 'READY') {
    throw Error('FORECAST_ROLLING_MODEL_WINDOW_BLOCKED');
  }
  return { review, reviewSha256: forecastReviewHash(review),
    parent: { asOf: priorReview.asOf, sha256: forecastReviewHash(priorReview) },
    createdAt: now.toISOString(), policy: 'REVIEWED_SEED_VERIFIED_SOURCE_UNCHANGED_OVERLAP_V1',
    verifiedNewSessions: sessions, verifiedOverlap: overlap };
}

export function assertForecastEvaluationEvidence(report, storageKey, cutoff) {
  const row = report?.schemaVersion === 1 && report.cutoff === cutoff && report.results?.find(row => row.key === storageKey);
  if (!row || !['ALREADY_REVIEWED', 'VERIFIED_ROLLFORWARD'].includes(row.status)) {
    throw Error('PREDICTION_EVALUATION_SOURCE_UNCONFIRMED ' + (row?.reason || storageKey));
  }
}
