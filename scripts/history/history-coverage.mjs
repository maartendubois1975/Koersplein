import { mergeChartHistoryBars } from '../../chart.js';
import { inspectDailyBarIntegrity } from '../cloudflare/europe-run-policy.mjs';

// Same price reconciliation as the chart; counts never add overlapping stores.
// Complete candles and independently saved daily confirmations are different.
export function historyCoverage({ archive, legacy, identity, review, statuses, sessions, start, cutoff }) {
  const base = new Map((legacy?.rows ?? []).map(bar => [bar.date, bar]));
  const tail = new Map((archive?.rows ?? []).map(bar => [bar.date, bar]));
  const sourceConflicts = [], statusConflicts = [], incomplete = [], reviewedDates = [], sourceReviewUnavailable = [];
  const complete = new Map(), confirmed = [];
  const invalidRaw = new Set([...(legacy?.invalidDates ?? []), ...(archive?.invalidDates ?? [])]);
  for (const date of [...new Set([...base.keys(), ...tail.keys()])].sort()) {
    let selected = base.get(date) ?? tail.get(date), resolved = false;
    if (tail.has(date)) {
      try {
        const proof = review?.resolutions?.find(row => row.date === date);
        const canReplay = base.has(date) || !proof?.base;
        if (proof && !canReplay) sourceReviewUnavailable.push(date);
        selected = mergeChartHistoryBars(base.has(date) ? [base.get(date)] : [], [tail.get(date)], {
          identity, review: canReplay ? review : undefined, onResolution() { resolved = true; },
        })[0];
      } catch (error) { sourceConflicts.push({ date, reason: error.message }); continue; }
    }
    if (invalidRaw.has(date) && !resolved ||
        !inspectDailyBarIntegrity({ bars: [selected] }, { startDate: date, endDate: date }).bars.length) {
      incomplete.push(date); continue;
    }
    const stored = statuses.get(date);
    if (stored?.status === 'NO_TRADES' || stored?.status === 'MARKET_CLOSED') {
      statusConflicts.push({ date, reason: 'STORED_CANDLE_CONTRADICTS_' + stored.status }); continue;
    }
    if (stored?.status === 'TRADED') {
      try {
        mergeChartHistoryBars([selected], [stored.bar]);
        confirmed.push(date);
      } catch { statusConflicts.push({ date, reason: 'STORED_CANDLE_CONTRADICTS_TRADED_ARCHIVE' }); continue; }
    }
    if (resolved) reviewedDates.push(date);
    complete.set(date, selected);
  }
  const noTrades = [], unverified = [], unverifiedWithBar = [], missing = [];
  const assessed = sessions.filter(date => start && date >= start && date <= cutoff);
  for (const date of assessed) {
    const status = statuses.get(date)?.status;
    if (status === 'NO_TRADES') noTrades.push(date);
    else if (status === 'SESSION_UNVERIFIED') {
      unverified.push(date);
      if (complete.has(date)) unverifiedWithBar.push(date);
    } else if (!complete.has(date)) missing.push(date);
  }
  const dates = [...complete.keys()];
  const calendarDates = new Set(sessions), noTradeDates = new Set(noTrades);
  const conflictedStatuses = new Set(statusConflicts.map(row => row.date));
  return { noTrades, unverified, unverifiedWithBar, missing,
    coverage: {
      completeUniqueDays: dates.length, confirmedArchiveDays: confirmed.length,
      reviewedSourceDays: reviewedDates.length,
      firstCompleteDate: dates[0] ?? null, lastCompleteDate: dates.at(-1) ?? null,
      sourceConflicts, statusConflicts, incompleteDates: incomplete, sourceReviewUnavailable,
      assessedSessions: assessed.length,
      coveredSessions: assessed.filter(date => !conflictedStatuses.has(date) && (complete.has(date) || noTradeDates.has(date))).length,
      calendarWindowStart: assessed[0] ?? null, calendarWindowEnd: assessed.at(-1) ?? null,
      beforeCalendarDays: dates.filter(date => !calendarDates.has(date)).length,
      quality: sourceConflicts.length || statusConflicts.length ? 'CONFLICT_REVIEW_REQUIRED'
        : sourceReviewUnavailable.length ? 'SOURCE_REVIEW_BASE_UNAVAILABLE_IN_BUILD'
        : dates.length ? 'COMPLETE_OHLCV_NOT_TOTAL_RETURN_VERIFIED' : 'NO_COMPLETE_STORED_OHLCV',
    },
  };
}
