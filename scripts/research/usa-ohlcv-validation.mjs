// Fail-closed, per-symbol validation of unadjusted daily bars before research persistence.
// Does not establish licensing, corporate-action accuracy, historical membership or PIT suitability.
const DAY = /^\d{4}-\d{2}-\d{2}$/;
function validDay(date) {
  if (typeof date !== 'string' || !DAY.test(date)) return false;
  const d = new Date(date + 'T00:00:00.000Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === date;
}
export function validateDailyOHLCV(bars, {start, end} = {}) {
  if (!Array.isArray(bars)) throw Error('INVALID_BARS_ARRAY');
  if (start !== undefined && !validDay(start)) throw Error('INVALID_HISTORY_START');
  if (end !== undefined && !validDay(end)) throw Error('INVALID_HISTORY_END');
  if (start && end && start > end) throw Error('INVERTED_HISTORY_WINDOW');
  let last = '';
  for (const [i, b] of bars.entries()) {
    const label = 'BAR_' + i;
    if (!b || !validDay(b.date)) throw Error('INVALID_TRADING_DATE:' + label);
    if (b.date <= last) throw Error('NON_INCREASING_TRADING_DATES:' + label);
    if ((start && b.date < start) || (end && b.date > end)) throw Error('OUT_OF_WINDOW_DATE:' + label);
    for (const key of ['open','high','low','close'])
      if (typeof b[key] !== 'number' || !Number.isFinite(b[key]) || b[key] <= 0)
        throw Error('INVALID_PRICE:' + label + ':' + key);
    if (b.low > Math.min(b.open, b.close) || b.high < Math.max(b.open, b.close) || b.high < b.low)
      throw Error('INCONSISTENT_OHLC:' + label);
    if (!Number.isSafeInteger(b.volume) || b.volume < 0) throw Error('INVALID_VOLUME:' + label);
    if (b.tradeCount != null && (!Number.isSafeInteger(b.tradeCount) || b.tradeCount < 0))
      throw Error('INVALID_TRADE_COUNT:' + label);
    last = b.date;
  }
  return {records:bars.length, firstDate:bars[0]?.date ?? null, lastDate:last || null};
}
