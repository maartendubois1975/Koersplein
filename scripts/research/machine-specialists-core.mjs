export function pricePatternFeatures(bars,i){
 const pct=(a,b)=>a&&b?b/a-1:null, mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
 const sd=a=>{if(a.length<2)return null;const m=mean(a);return Math.sqrt(mean(a.map(x=>(x-m)**2)))};
 if(i<252)return null;const c=bars[i].close, closes=bars.slice(i-252,i+1).map(x=>x.close);
 const returns=bars.slice(i-125,i+1).map((x,j,a)=>j?pct(a[j-1].close,x.close):null).filter(Number.isFinite);
 const m1=pct(bars[i-21]?.close,c),m3=pct(bars[i-63]?.close,c),m6=pct(bars[i-126]?.close,c),m12=pct(bars[i-252]?.close,c);
 const prior3=pct(bars[i-126]?.close,bars[i-63]?.close);
 const high=Math.max(...closes),low=Math.min(...closes);
 return {momentum1m:m1,momentum3m:m3,momentum6m:m6,momentum12m:m12,acceleration:m3==null||prior3==null?null:m3-prior3,volatility126:sd(returns),distance52wHigh:high?c/high-1:null,recovery52w:low?c/low-1:null};
}
export function anomalyLoserGuard(features){
 const f=features||{};let warnings=[];
 if(Number.isFinite(f.volatility126)&&f.volatility126>.05)warnings.push('EXTREME_VOLATILITY');
 if(Number.isFinite(f.distance52wHigh)&&f.distance52wHigh<-.40)warnings.push('DEEP_DRAWDOWN');
 if(Number.isFinite(f.momentum3m)&&f.momentum3m<-.20)warnings.push('NEGATIVE_3M_MOMENTUM');
 if(Number.isFinite(f.acceleration)&&f.acceleration<-.20)warnings.push('SHARP_DECELERATION');
 return {warnings,guardActive:warnings.length>0};
}
export function peerRelativeFeatures(row,peerRows){
 const finite=(x)=>Number.isFinite(Number(x));const peers=peerRows.filter(x=>x!==row&&finite(x?.features?.momentum6m));
 if(!finite(row?.features?.momentum6m)||!peers.length)return {peerCount:peers.length,relativeMomentum6m:null,percentile:null};
 const vals=peers.map(x=>Number(x.features.momentum6m)).sort((a,b)=>a-b),v=Number(row.features.momentum6m);
 return {peerCount:peers.length,relativeMomentum6m:v-vals.reduce((a,b)=>a+b,0)/vals.length,percentile:vals.filter(x=>x<=v).length/vals.length};
}
