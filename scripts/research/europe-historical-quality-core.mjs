// Fail closed: aggregate counts alone cannot establish per-instrument historical coverage.
export function assessHistoricalCoverage(coverage, evidence) {
  const instruments=Number(coverage.instruments??0);
  const usable=Number(coverage.usableInstruments??0);
  // Observations are model signal rows, NOT OHLCV bar counts.
  const observations=Number(coverage.observations??0);
  const failed=Number(coverage.failed??0);
  const insufficient=Number(coverage.insufficientHistory??0);
  const missingIsin=Number(coverage.skippedMissingIsin??0);
  const provisional=Number(coverage.provisionalIdentities??0);
  const issues=[];
  for(const [name,value] of Object.entries({instruments,usable,observations,failed,insufficient,missingIsin,provisional})) {
    if(!Number.isSafeInteger(value)||value<0)issues.push('INVALID_HISTORICAL_COUNT_'+name.toUpperCase());
  }
  if(usable>instruments)issues.push('USABLE_EXCEEDS_CATALOG_'+usable+'_OF_'+instruments);
  if(failed>instruments)issues.push('FAILURES_EXCEED_CATALOG_'+failed+'_OF_'+instruments);
  if(insufficient>instruments)issues.push('INSUFFICIENT_EXCEEDS_CATALOG_'+insufficient+'_OF_'+instruments);
  if(provisional>instruments)issues.push('PROVISIONAL_EXCEEDS_CATALOG_'+provisional+'_OF_'+instruments);
  if(provisional>0)issues.push('PROVISIONAL_IDENTITIES_'+provisional);
  if(instruments<=0)issues.push('EMPTY_MARKET_CATALOG');
  if(observations<=0)issues.push('NO_HISTORICAL_OBSERVATIONS');
  if(usable<=0)issues.push('NO_USABLE_INSTRUMENTS');
  if(failed>0)issues.push('HISTORICAL_FETCH_FAILURES_'+failed);
  if(insufficient>0)issues.push('INSUFFICIENT_HISTORY_INSTRUMENTS_'+insufficient);
  if(missingIsin>0)issues.push('MISSING_ISIN_IDENTITIES_'+missingIsin);
  if(instruments>0&&usable<instruments)issues.push('PARTIAL_HISTORY_COVERAGE_'+usable+'_OF_'+instruments);
  if(usable+failed+insufficient+missingIsin!==instruments)issues.push('HISTORICAL_COUNTS_DO_NOT_RECONCILE');

  if(!evidence||!Array.isArray(evidence.records)) {
    issues.push('MISSING_PER_INSTRUMENT_HISTORY_EVIDENCE');
  } else {
    if(evidence.catalogInstruments!==instruments||evidence.records.length!==instruments)issues.push('HISTORY_EVIDENCE_CATALOG_MISMATCH');
    const counts={HISTORY_AVAILABLE:0,HISTORY_FETCH_ERROR:0,INSUFFICIENT_HISTORY:0,MISSING_ISIN:0};
    let provisionalRecords=0;
    const isoDate=/^\d{4}-\d{2}-\d{2}$/;
    for(let i=0;i<evidence.records.length;i++) {
      const record=evidence.records[i];
      if(!record||typeof record!=='object'||!Object.hasOwn(counts,record.status)) {
        issues.push('INVALID_HISTORY_RECORD_'+i);continue;
      }
      counts[record.status]++;
      if(record.provisionalIdentity===true)provisionalRecords++;
      if(typeof record.identity!=='string'||!record.identity.trim())issues.push('MISSING_HISTORY_IDENTITY_'+i);
      if(record.status==='HISTORY_AVAILABLE') {
        if(!Number.isSafeInteger(record.bars)||record.bars<260)issues.push('UNPROVEN_HISTORY_BAR_COUNT_'+i);
        if(typeof record.source!=='string'||!record.source.trim())issues.push('MISSING_HISTORY_SOURCE_'+i);
        if(!isoDate.test(record.firstDate??'')||!isoDate.test(record.lastDate??'')||record.firstDate>record.lastDate)issues.push('INVALID_HISTORY_DATE_RANGE_'+i);
      }
    }
    if(counts.HISTORY_AVAILABLE!==usable||counts.HISTORY_FETCH_ERROR!==failed||counts.INSUFFICIENT_HISTORY!==insufficient||counts.MISSING_ISIN!==missingIsin)issues.push('HISTORY_EVIDENCE_TOTALS_MISMATCH');
    if(provisionalRecords!==provisional)issues.push('HISTORY_EVIDENCE_PROVISIONAL_MISMATCH');
    if(evidence.usableInstruments!==usable||evidence.insufficientHistory!==insufficient||evidence.failed!==failed||evidence.missingIsin!==missingIsin||evidence.provisionalIdentities!==provisional)issues.push('HISTORY_EVIDENCE_SUMMARY_MISMATCH');
  }
  return {issues,complete:issues.length===0,instruments,usable,observations,failed,insufficient};
}
