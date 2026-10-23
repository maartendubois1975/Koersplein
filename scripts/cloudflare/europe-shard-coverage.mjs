// Fail closed if any COMPLETE market is missing, duplicated or reported by
// the wrong shard. Counting eight JSON files alone does not prove coverage.
export function evaluateEuropeShardCoverage(plan,updates,audits,shardCount=8) {
  if(!Number.isInteger(shardCount)||shardCount<1)throw Error('Invalid shard count');
  const complete=(plan.markets||[]).filter(m=>m.state==='COMPLETE');
  const expected=Array.from({length:shardCount},(_,shard)=>complete.filter((_,i)=>i%shardCount===shard).map(m=>m.mic));
  const anomalies=[];
  const validate=(kind,reports)=>{
    for(const report of reports)if(!Number.isInteger(report.shardIndex)||report.shardIndex<0||report.shardIndex>=shardCount)
      anomalies.push({kind,issue:'INVALID_SHARD_INDEX',shard:report.shardIndex});
    for(let shard=0;shard<shardCount;shard++){
      const matching=reports.filter(r=>r.shardIndex===shard);
      if(matching.length!==1){anomalies.push({kind,issue:'REPORT_COUNT',shard,expected:1,actual:matching.length});continue;}
      const report=matching[0];
      if(report.shardCount!==shardCount)anomalies.push({kind,issue:'SHARD_COUNT_MISMATCH',shard,actual:report.shardCount});
      const actual=(report.markets||[]).map(m=>m.mic);
      const actualSet=new Set(actual),expectedSet=new Set(expected[shard]);
      for(const mic of expected[shard])if(!actualSet.has(mic))anomalies.push({kind,issue:'MISSING_MARKET',shard,mic});
      for(const mic of actualSet)if(!expectedSet.has(mic))anomalies.push({kind,issue:'UNEXPECTED_MARKET',shard,mic});
      if(actual.length!==actualSet.size)anomalies.push({kind,issue:'DUPLICATE_MARKET',shard});
    }
  };
  validate('update',updates);validate('audit',audits);
  if(new Set(complete.map(m=>m.mic)).size!==complete.length)anomalies.push({issue:'DUPLICATE_PLAN_MARKET'});
  return {complete:anomalies.length===0,expectedMarkets:complete.length,reportedUpdateMarkets:updates.reduce((n,r)=>n+(r.markets||[]).length,0),reportedAuditMarkets:audits.reduce((n,r)=>n+(r.markets||[]).length,0),anomalies};
}
