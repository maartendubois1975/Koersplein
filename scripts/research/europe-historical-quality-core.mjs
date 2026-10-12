// Conservative gate: an operational market requires usable price history, not just a completed script.
export function assessHistoricalCoverage(coverage){
 const instruments=Number(coverage.instruments??0),usable=Number(coverage.usableInstruments??0),observations=Number(coverage.observations??0),failed=Number(coverage.failed??0),insufficient=Number(coverage.insufficientHistory??0);
 const provisional=Number(coverage.provisionalIdentities??0);
 const issues=[];
 for(const [name,value] of Object.entries({instruments,usable,observations,failed,insufficient,provisional})){
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
 if(instruments>0&&usable<instruments)issues.push('PARTIAL_HISTORY_COVERAGE_'+usable+'_OF_'+instruments);
 return {issues,complete:issues.length===0,instruments,usable,observations,failed,insufficient};
}
