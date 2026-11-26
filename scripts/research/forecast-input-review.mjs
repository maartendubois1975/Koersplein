import { createHash } from 'node:crypto';
import { assessPeriod } from './amsterdam-period-quality.mjs';
import { loadApprovedHistory } from './market-history-source.mjs';

export const forecastLookback = 253;

export function loadForecastHistory(share, mic, options) {
  return loadApprovedHistory(share, mic, { ...options, requirePredictionEvidence: true });
}

export function assessForecastWindow(bars, cutoff) {
  const lastDate = bars.at(-1)?.date ?? null;
  if (lastDate !== cutoff) return { status: 'STALE_HISTORY', lastDate };
  if (bars.length < forecastLookback) return { status: 'INSUFFICIENT_HISTORY', records: bars.length };
  const window = bars.slice(-forecastLookback);
  const { issues } = assessPeriod(window);
  if (issues.length) return { status: 'HISTORY_QUALITY_BLOCKED', issues };
  return { status: 'READY',
    windowSha256: createHash('sha256').update(JSON.stringify(window.map(bar =>
      [bar.date, bar.open, bar.high, bar.low, bar.close, bar.volume]))).digest('hex') };
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
