function finite(v){v=Number(v);return Number.isFinite(v)?v:null}
export function relativeReturn(stockReturn, benchmarkReturn){const s=finite(stockReturn),b=finite(benchmarkReturn);return s==null||b==null?null:s-b}
export function breadth(returns){const x=returns.map(finite).filter(v=>v!=null);if(!x.length)return null;return {positive:x.filter(v=>v>0).length/x.length,negative:x.filter(v=>v<0).length/x.length,n:x.length}}
export function weightedExposure(edges, shocks){let sum=0,weight=0;const parents=[];for(const e of edges){const w=finite(e.weight),shock=finite(shocks[e.targetEntityId]);if(w==null||shock==null)continue;sum+=w*shock;weight+=Math.abs(w);if(e.evidenceId)parents.push(e.evidenceId)}return weight?{value:sum/weight,parentEvidenceIds:parents}:null}
export function assertComparable(a,b){for(const k of ['returnDefinition','currency','calendar'])if(a[k]!==b[k])throw new Error(`RELATIVE_INCOMPARABLE_${k}`);return true}
