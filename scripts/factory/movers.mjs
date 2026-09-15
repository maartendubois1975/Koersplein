export function calculateMovers(db, { mic = 'XAMS', minimumCoverage = 20, limit = 10 } = {}) {
  const dates = db.prepare(`SELECT dp.trading_date, COUNT(DISTINCT dp.instrument_id) instruments
    FROM daily_prices dp JOIN instruments i ON i.id=dp.instrument_id
    WHERE i.mic=? GROUP BY dp.trading_date HAVING instruments >= ? ORDER BY dp.trading_date DESC LIMIT 2`).all(mic, minimumCoverage);
  if (dates.length < 2) return { status: 'DATASET_UNAVAILABLE', reason: `Minimaal ${minimumCoverage} instrumenten op twee handelsdagen vereist`, gainers: [], losers: [] };
  const [latest, previous] = dates;
  const rows = db.prepare(`SELECT i.company, i.ticker, i.isin, i.mic, m.name market, m.country,
    current.close, ((current.close / prior.close) - 1) * 100 changePercent
    FROM daily_prices current JOIN daily_prices prior ON prior.instrument_id=current.instrument_id AND prior.trading_date=?
    JOIN instruments i ON i.id=current.instrument_id JOIN markets m ON m.id=i.market_id
    WHERE current.trading_date=? AND i.mic=? AND prior.close>0 ORDER BY changePercent DESC`).all(previous.trading_date, latest.trading_date, mic);
  return { status: 'AVAILABLE', tradingDate: latest.trading_date, previousTradingDate: previous.trading_date, gainers: rows.slice(0, limit), losers: rows.slice(-limit).reverse() };
}
