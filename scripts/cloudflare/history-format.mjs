import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';

export const STORAGE_FORMAT = 'ndjson+gzip-v1';

export function normalizeBar(bar) {
  const numeric = (value, required = false) => {
    if (value === null || value === undefined || value === '') return required ? NaN : null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : NaN;
  };
  const result = {
    date: String(bar.date || ''),
    open: numeric(bar.open), high: numeric(bar.high), low: numeric(bar.low),
    close: numeric(bar.close, true), volume: numeric(bar.volume),
    adjustedClose: numeric(bar.adjustedClose ?? bar.adjusted_close)
  };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result.date) || !Number.isFinite(result.close) || result.close < 0) throw new Error(`Ongeldige koersdag ${result.date || '(zonder datum)'}`);
  for (const field of ['open', 'high', 'low']) if (Number.isNaN(result[field]) || (result[field] !== null && result[field] < 0)) throw new Error(`Ongeldige ${field} op ${result.date}`);
  if (result.high !== null && result.low !== null && result.high < result.low) throw new Error(`High lager dan low op ${result.date}`);
  if (Number.isNaN(result.volume) || (result.volume !== null && result.volume < 0)) result.volume = null;
  if (Number.isNaN(result.adjustedClose) || (result.adjustedClose !== null && result.adjustedClose < 0)) result.adjustedClose = null;
  return result;
}

export function mergeBars(existing = [], incoming = []) {
  const byDate = new Map();
  for (const bar of [...existing, ...incoming]) byDate.set(bar.date, normalizeBar(bar));
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function partitionBars(bars) {
  const result = new Map();
  for (const bar of bars.map(normalizeBar)) {
    const period = bar.date.slice(0, 4);
    if (!result.has(period)) result.set(period, []);
    result.get(period).push(bar);
  }
  for (const [period, rows] of result) result.set(period, mergeBars([], rows));
  return result;
}

export function encodePartition(bars) {
  const body = Buffer.from(bars.map((bar) => JSON.stringify(normalizeBar(bar))).join('\n') + '\n');
  return gzipSync(body, { level: 9 });
}

export function decodePartition(body) {
  if (!body?.length) return [];
  return gunzipSync(body).toString('utf8').trim().split('\n').filter(Boolean).map((line) => normalizeBar(JSON.parse(line)));
}

export const checksum = (body) => createHash('sha256').update(body).digest('hex');
export const objectKey = ({ mic, isin, period }) => `history/v1/mic=${mic}/isin=${isin}/year=${period}/prices.ndjson.gz`;
