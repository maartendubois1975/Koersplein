const validSessionDate = date => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date + 'T00:00:00Z').toISOString().slice(0,10) === date;

export function validateBars(bars) {
  const seen = new Set();
  return bars.filter((bar) => {
    if (!bar || !validSessionDate(bar.date) || seen.has(bar.date) || !Number.isFinite(bar.open) || bar.open <= 0 || !Number.isFinite(bar.close) || bar.close <= 0) return false;
    if (bar.high != null && (!Number.isFinite(bar.high) || bar.high <= 0)) return false;
    if (bar.low != null && (!Number.isFinite(bar.low) || bar.low <= 0)) return false;
    if (Number.isFinite(bar.high) && Number.isFinite(bar.low) && bar.high < bar.low) return false;
    if (Number.isFinite(bar.high) && (bar.high < bar.close || bar.high < bar.open)) return false;
    if (Number.isFinite(bar.low) && (bar.low > bar.close || bar.low > bar.open)) return false;
    seen.add(bar.date);
    return true;
  }).sort((a, b) => a.date.localeCompare(b.date));
}

export function verifiedBackfillComplete(existing, fetchedMeta = {}) {
  return existing?.coverage?.backfillComplete === true &&
    existing?.provider?.metadata?.completenessEvidenceVerified === true &&
    fetchedMeta.partialHistory !== true;
}

export function mergeBars(existing = [], incoming = []) {
  // A broken provider response must never overwrite a previously valid bar.
  // Validate incoming records before applying them, rather than dropping the
  // entire merged date after an invalid overwrite.
  const byDate = new Map(validateBars(existing).map(bar => [bar.date, bar]));
  for (const bar of incoming) {
    if (!bar || typeof bar.date !== 'string') continue;
    const merged = { ...byDate.get(bar.date), ...bar };
    if (validateBars([merged]).length === 1) byDate.set(bar.date, merged);
  }
  return validateBars([...byDate.values()]);
}

// Movers must refer to the same latest observed trading session. Older last
// trades remain visible in history but must not be ranked as today's movers.
// An explicit targetSession allows callers to enforce an official session date.
export function computeMovers(series, { targetSession = null } = {}) {
  const prepared = series.map(({ instrument, bars, provider }) => {
    const valid = validateBars(bars);
    return { instrument, provider, valid, latest: valid.at(-1) };
  });
  const session = targetSession || prepared.map(x => x.latest?.date).filter(Boolean).sort().at(-1);
  if (!session || !/^\d{4}-\d{2}-\d{2}$/.test(session)) return [];
  return prepared.flatMap(({ instrument, provider, valid, latest }) => {
    if (valid.length < 2 || latest?.date !== session) return [];
    const previous = valid.at(-2);
    // A gap can indicate a trading suspension or missing provider sessions.
    // Do not mislabel an arbitrarily old comparison as a one-day movement.
    const gapDays = (Date.parse(latest.date + 'T00:00:00Z') - Date.parse(previous.date + 'T00:00:00Z')) / 86400000;
    if (!Number.isFinite(gapDays) || gapDays > 4 || gapDays < 1) return [];
    return [{ isin: instrument.isin, name: instrument.name, symbol: instrument.symbol, exchange: instrument.market, mic: instrument.mic, country: instrument.country || null, close: latest.close, changePercent: ((latest.close / previous.close) - 1) * 100, tradingDate: latest.date, previousTradingDate: previous.date, provider }];
  }).sort((a, b) => b.changePercent - a.changePercent);
}

