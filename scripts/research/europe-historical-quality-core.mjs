// Conservative gate: an operational market requires usable price history, not just a completed script.
export function assessHistoricalCoverage(coverage){
 const instruments=Number(coverage.instruments||0),usable=Number(coverage.usableInstruments||0),observations=Number(coverage.observations||0),failed=Number(coverage.failed||0),insufficient=Number(coverage.insufficientHistory||0);
 const issues=[];
 if(instruments<=0)issues.push('EMPTY_MARKET_CATALOG');
 if(observations<=0)issues.push('NO_HISTORICAL_OBSERVATIONS');
 if(usable<=0)issues.push('NO_USABLE_INSTRUMENTS');
 if(failed>0)issues.push('HISTORICAL_FETCH_FAILURES_'+failed);
 if(insufficient>0)issues.push('INSUFFICIENT_HISTORY_INSTRUMENTS_'+insufficient);
 if(instruments>0&&usable<instruments)issues.push('PARTIAL_HISTORY_COVERAGE_'+usable+'_OF_'+instruments);
 return {issues,complete:issues.length===0,instruments,usable,observations,failed,insufficient};
}

/**
 * A full count of bars is not proof of trustworthy source identity.
 * Reject provisional Yahoo-symbol histories until exchange identity is verified.
 */
export function assessHistoricalProvenance(report,{mic,instruments,usable}={}){
 const issues=[];
 const records=Array.isArray(report?.records)?report.records:null;
 if(!records)return {issues:['MISSING_HISTORY_PROVENANCE_RECORDS'],provisionalCount:0};
 if(report.market!==mic)issues.push('HISTORY_PROVENANCE_MARKET_MISMATCH');
 if(report.catalogInstruments!==instruments||records.length!==instruments)issues.push('HISTORY_PROVENANCE_RECORD_COUNT_MISMATCH');
 const available=records.filter(r=>r.status==='HISTORY_AVAILABLE');
 if(available.length!==usable)issues.push('HISTORY_PROVENANCE_USABLE_COUNT_MISMATCH');
 const provisionalCount=available.filter(r=>r.provisionalIdentity===true||String(r.source||'').includes('PROVISIONAL')).length;
 if(provisionalCount)issues.push('UNVERIFIED_PROVISIONAL_HISTORY_'+provisionalCount);
 const unverified=available.filter(r=>!r.identity||!r.source||!Number.isFinite(Number(r.bars))||Number(r.bars)<260).length;
 if(unverified)issues.push('INCOMPLETE_HISTORY_PROVENANCE_'+unverified);
 return {issues,provisionalCount,verifiedAvailable:available.length-provisionalCount-unverified};
}
