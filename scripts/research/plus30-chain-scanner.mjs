// Koersplein +30%-kettingscanner
// Definitie: start op eerste beschikbare dag. Zodra koers voor het eerst >= 1.30 * nulpunt sluit,
// registreer exact één hit en maak die daadwerkelijke raakkoers onmiddellijk het nieuwe nulpunt.
// De volgende hit wordt uitsluitend vanaf dit nieuwe nulpunt gezocht. Geen overlappende dag-erna dubbeltelling.
// Per stap bewaren we kalenderdagen, handelsdagen en of de hit binnen 90 kalenderdagen viel.

export function scanPlus30Chain(points, { threshold = 0.30, horizonDays = 90 } = {}) {
  const clean = points
    .filter(p => p && Number.isFinite(Number(p.close)) && Number(p.close) > 0 && p.date)
    .map(p => ({ date: String(p.date).slice(0, 10), close: Number(p.close) }))
    .sort((a,b) => a.date.localeCompare(b.date));
  if (clean.length < 2) return { hits: [], unresolved: null };

  let anchorIndex = 0;
  let anchor = clean[0];
  const hits = [];

  for (let i = 1; i < clean.length; i++) {
    const p = clean[i];
    const target = anchor.close * (1 + threshold);
    if (p.close + Number.EPSILON < target) continue;
    const calendarDays = Math.round((Date.parse(p.date + 'T00:00:00Z') - Date.parse(anchor.date + 'T00:00:00Z')) / 86400000);
    hits.push({
      anchorDate: anchor.date,
      anchorClose: anchor.close,
      firstHitDate: p.date,
      firstHitClose: p.close,
      threshold,
      targetPrice: target,
      calendarDays,
      tradingDays: i - anchorIndex,
      within90Days: calendarDays <= horizonDays,
      realizedStep: p.close / anchor.close - 1
    });
    anchorIndex = i;
    anchor = p;
  }

  return {
    hits,
    unresolved: {
      anchorDate: anchor.date,
      anchorClose: anchor.close,
      targetPrice: anchor.close * (1 + threshold),
      lastDate: clean.at(-1).date,
      lastClose: clean.at(-1).close
    }
  };
}

export function summarizePlus30Chains(results, horizonDays = 90) {
  const hits = results.flatMap(r => r.hits || []);
  const fast = hits.filter(h => h.calendarDays <= horizonDays);
  const sorted = fast.map(h => h.calendarDays).sort((a,b)=>a-b);
  const median = sorted.length ? sorted[Math.floor(sorted.length/2)] : null;
  const bucket = (lo, hi) => fast.filter(h => h.calendarDays >= lo && h.calendarDays <= hi).length;
  return {
    totalChainSteps: hits.length,
    within90Days: fast.length,
    over90Days: hits.length - fast.length,
    shareWithin90Days: hits.length ? fast.length / hits.length : null,
    medianCalendarDaysWithin90: median,
    buckets: {
      d1_5: bucket(1,5), d6_10: bucket(6,10), d11_20: bucket(11,20),
      d21_30: bucket(21,30), d31_60: bucket(31,60), d61_90: bucket(61,90)
    }
  };
}
