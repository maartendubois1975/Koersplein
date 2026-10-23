// The daily audit is only comparable across shards when every update and
// audit used the same completed-session cutoff. A UTC 18:00 boundary can
// change between two runs on the same calendar day. Never infer a missing
// cutoff from the report's generatedAt timestamp.
function validIsoDay(value) {
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const parsed=new Date(value+'T00:00:00Z');
 return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
}
export function evaluateEuropeSessionConsistency(updates,audits,shardCount=8) {
 const anomalies=[],observed=new Set();
 for(const [kind,reports] of [['update',updates],['audit',audits]]) {
  if(reports.length!==shardCount)anomalies.push({kind,issue:'SESSION_REPORT_COUNT',expected:shardCount,actual:reports.length});
  for(const report of reports) {
   if(!validIsoDay(report?.freshnessCutoff)) {
    anomalies.push({kind,issue:'MISSING_OR_INVALID_SESSION_CUTOFF',shard:report?.shardIndex??null});
   } else observed.add(report.freshnessCutoff);
  }
 }
 const observedCutoffs=[...observed].sort();
 if(observedCutoffs.length!==1)anomalies.push({issue:'SESSION_CUTOFF_MISMATCH',observedCutoffs});
 return {complete:anomalies.length===0,cutoff:anomalies.length===0?observedCutoffs[0]:null,observedCutoffs,anomalies};
}
