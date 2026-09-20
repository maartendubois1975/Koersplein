const DAY=86400000;
const monthsToDays=(m)=>Math.round(m*365.2425/12);
const pct=(a,b)=>((b/a)-1)*100;
function quantile(sorted,q){if(!sorted.length)return null;const i=(sorted.length-1)*q,l=Math.floor(i),h=Math.ceil(i);return sorted[l]+(sorted[h]-sorted[l])*(i-l)}
export function buildBaseRates(snapshot,{horizons=[1,3,6,12,24],targets=[10,20,30,40,50]}={}){
 const bars=snapshot.bars, out=[];
 for(const hm of horizons){const hd=monthsToDays(hm), horizonMs=hd*DAY;
  for(const target of targets){let eligible=0,hits=0;const endReturns=[],times=[],mfes=[],maes=[];
   for(let i=0;i<bars.length;i++){const start=bars[i],endLimit=Date.parse(start.date)+horizonMs;let j=i+1,last=null,max=-Infinity,min=Infinity,hitDate=null;
    while(j<bars.length&&Date.parse(bars[j].date)<=endLimit){const r=pct(start.close,bars[j].close);max=Math.max(max,r);min=Math.min(min,r);if(hitDate===null&&r>=target)hitDate=bars[j].date;last=bars[j];j++}
    if(!last)continue; if(Date.parse(last.date)-Date.parse(start.date)<horizonMs-DAY*10)continue;
    eligible++;const er=pct(start.close,last.close);endReturns.push(er);mfes.push(max);maes.push(min);
    if(hitDate){hits++;times.push((Date.parse(hitDate)-Date.parse(start.date))/DAY)}
   }
   const sr=[...endReturns].sort((a,b)=>a-b);
   out.push({horizon_months:hm,target_pct:target,sample_size:eligible,hits,hit_rate:eligible?hits/eligible:null,median_end_return_pct:quantile(sr,.5),median_time_to_target_days:times.length?quantile([...times].sort((a,b)=>a-b),.5):null,median_mfe_pct:mfes.length?quantile([...mfes].sort((a,b)=>a-b),.5):null,median_mae_pct:maes.length?quantile([...maes].sort((a,b)=>a-b),.5):null});
  }
 }
 return out;
}
export function buildPriceFeatures(snapshot,cutoffIndex){
 const b=snapshot.bars,i=cutoffIndex,cur=b[i]; if(!cur)return null;
 const ret=(days)=>{let k=i;const t=Date.parse(cur.date)-days*DAY;while(k>0&&Date.parse(b[k].date)>t)k--;return k<i?pct(b[k].close,cur.close):null};
 const win=b.slice(Math.max(0,i-251),i+1), closes=win.map(x=>x.close);
 const high=Math.max(...closes),low=Math.min(...closes);
 return {date:cur.date,close:cur.close,return_21d_pct:ret(30),return_63d_pct:ret(91),return_126d_pct:ret(182),return_252d_pct:ret(365),distance_1y_high_pct:pct(high,cur.close),distance_1y_low_pct:pct(low,cur.close)};
}
export function makeChronologicalSplits(bars){const n=bars.length;return {train_end:bars[Math.max(0,Math.floor(n*.6)-1)]?.date,validation_end:bars[Math.max(0,Math.floor(n*.8)-1)]?.date,test_start:bars[Math.floor(n*.8)]?.date};}
export function blindScore(features){const vals=[features.return_21d_pct,features.return_63d_pct,features.return_126d_pct,features.return_252d_pct].filter(Number.isFinite);return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null;}
export function scoreForward(snapshot,index,horizonMonths,targetPct){const start=snapshot.bars[index];if(!start)return null;const limit=Date.parse(start.date)+monthsToDays(horizonMonths)*DAY;let last=null,max=-Infinity,min=Infinity,hit=null;for(let j=index+1;j<snapshot.bars.length&&Date.parse(snapshot.bars[j].date)<=limit;j++){last=snapshot.bars[j];const r=pct(start.close,last.close);max=Math.max(max,r);min=Math.min(min,r);if(hit===null&&r>=targetPct)hit=last.date}if(!last)return null;return {end_return_pct:pct(start.close,last.close),target_hit:!!hit,target_hit_date:hit,mfe_pct:max,mae_pct:min};}
