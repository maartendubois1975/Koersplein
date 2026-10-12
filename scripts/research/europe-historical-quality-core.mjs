// Conservative gate: an operational market requires usable price history, not just a completed script.
export function assessHistoricalCoverage(coverage){
 const instruments=Number(coverage.instruments||0),usable=Number(coverage.usableInstruments||0),observations=Number(coverage.observations||0),failed=Number(coverage.failed||0),insufficient=Number(coverage.insufficientHistory||0);
 const provisional=Number(coverage.provisionalIdentities||0);
 const issues=[];
 if(provisional>0)issues.push('PROVISIONAL_IDENTITIES_'+provisional);
 if(instruments<=0)issues.push('EMPTY_MARKET_CATALOG');
 if(observations<=0)issues.push('NO_HISTORICAL_OBSERVATIONS');
 if(usable<=0)issues.push('NO_USABLE_INSTRUMENTS');
 if(failed>0)issues.push('HISTORICAL_FETCH_FAILURES_'+failed);
 if(insufficient>0)issues.push('INSUFFICIENT_HISTORY_INSTRUMENTS_'+insufficient);
 if(instruments>0&&usable<instruments)issues.push('PARTIAL_HISTORY_COVERAGE_'+usable+'_OF_'+instruments);
 return {issues,complete:issues.length===0,instruments,usable,observations,failed,insufficient};
}
