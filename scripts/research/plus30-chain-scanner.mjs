// Historical +30% chained-return scanner. Each hit becomes the next baseline.
export function scanPlus30Chain(bars, threshold = 0.30) {
  const ordered = (bars || []).map(x => ({date: String(x.date || '').slice(0, 10), close: Number(x.close)}))
    .filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x.date) && Number.isFinite(x.close) && x.close > 0)
    .sort((a,b) => a.date.localeCompare(b.date));
  const points = [...new Map(ordered.map(x => [x.date, x])).values()];
  if (!points.length) return {hits: [], totalHits: 0, startingClose: null, endingClose: null};
  let baseline = points[0], hits = [];
  for (const bar of points.slice(1)) {
    if (bar.close < baseline.close * (1 + threshold)) continue;
    const calendarDays = Math.round((Date.parse(bar.date) - Date.parse(baseline.date)) / 86400000);
    hits.push({startDate: baseline.date, hitDate: bar.date, startClose: baseline.close, hitClose: bar.close, gainPct: (bar.close / baseline.close - 1) * 100, calendarDays});
    baseline = bar;
  }
  return {hits, totalHits: hits.length, startingClose: points[0].close, endingClose: points.at(-1).close};
}
export function summarizePlus30Chains(results, maxDays = 90) {
  const hits = (results || []).flatMap(x => x.hits || []);
  const fast = hits.filter(x => x.calendarDays <= maxDays);
  return {stocks: (results || []).length, totalHits: hits.length, hitsWithinWindow: fast.length, maxCalendarDays: maxDays, stocksWithHits: (results || []).filter(x => (x.hits || []).length > 0).length};
}
