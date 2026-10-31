// Pure staging diagnostics: newest provider date is not proof of official closing.
const validDate = date => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) &&
  !Number.isNaN(Date.parse(date)) && new Date(date+'T00:00:00Z').toISOString().slice(0,10) === date;
export function sessionReadiness(rows,expectedCount=80) {
  if (!Array.isArray(rows) || !Number.isInteger(expectedCount) || expectedCount<1)
    throw new Error('Invalid session universe');
  const validRows=rows.filter(row=>row && validDate(row.latestDate));
  const newestDate=validRows.map(row=>row.latestDate).sort().at(-1)||null;
  const current=[],lagging=[],invalid=[],unavailable=[];
  for (const row of rows) {
    if (!row || row.error || !row.latestDate) { unavailable.push(row); continue; }
    if (!validDate(row.latestDate) || !Number.isFinite(row.open) || row.open<=0 ||
        !Number.isFinite(row.close) || row.close<=0 ||
        !Number.isInteger(row.rejectedRecords??0) || (row.rejectedRecords??0)>0) {
      invalid.push(row); continue;
    }
    if (row.latestDate!==newestDate) lagging.push(row);
    else current.push(row);
  }
  const identities=rows.map(row=>row?.isin).filter(Boolean);
  const identityUnique=identities.length===rows.length && new Set(identities).size===rows.length;
  const countMatches=rows.length===expectedCount;
  return {
    schemaVersion:2,scope:'XAMS_OBSERVED_SESSION_NOT_OFFICIAL_CLOSE',
    expectedCount,observedCount:rows.length,newestDate,
    currentCount:current.length,laggingCount:lagging.length,
    invalidCount:invalid.length,unavailableCount:unavailable.length,
    countMatches,identityUnique,
    latestObservedDateAgeDays: newestDate ? Math.floor((Date.now()-Date.parse(newestDate+'T00:00:00Z'))/86400000) : null,
    completeForObservedSession:countMatches && identityUnique && newestDate!==null &&
      lagging.length===0 && invalid.length===0 && unavailable.length===0,
    current,lagging,invalid,unavailable,
    note:'An observed provider date does not establish official close; suspended trading, missing candles and licensing need independent verification.'
  };
}
