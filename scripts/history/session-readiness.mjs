// Pure diagnostic for the latest observed XAMS session. No inference about official exchange closure.
export function sessionReadiness(rows, expectedCount=80) {
  if (!Array.isArray(rows)) throw new Error('Session rows must be an array');
  const dates=rows.map(x=>x.latestDate).filter(x=>typeof x==='string' && /^\d{4}-\d{2}-\d{2}$/.test(x));
  const newestDate=dates.sort().at(-1)||null;
  const current=[],lagging=[],invalid=[],unavailable=[];
  for (const row of rows) {
    if (row.error || !row.latestDate) { unavailable.push(row); continue; }
    if (!Number.isFinite(row.open) || row.open<=0 || !Number.isFinite(row.close) || row.close<=0) {
      invalid.push(row); continue;
    }
    if (row.latestDate!==newestDate) lagging.push(row);
    else current.push(row);
  }
  return {
    schemaVersion:1,scope:'XAMS_OBSERVED_SESSION_NOT_OFFICIAL_CLOSE',
    expectedCount,observedCount:rows.length,newestDate,
    currentCount:current.length,laggingCount:lagging.length,
    invalidCount:invalid.length,unavailableCount:unavailable.length,
    countMatches:rows.length===expectedCount,
    completeForObservedSession:rows.length===expectedCount && lagging.length===0 && invalid.length===0 && unavailable.length===0,
    current,lagging,invalid,unavailable,
    note:'Latest observed provider date is not proof of official session close; stale or suspended trading requires independent review.'
  };
}
