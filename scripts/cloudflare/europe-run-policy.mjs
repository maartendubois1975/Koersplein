// Conservative close boundary for the weekday production run (18:45 UTC).
export function latestClosedWeekday(now=new Date()) {
 const d=new Date(now);if(d.getUTCHours()<18)d.setUTCDate(d.getUTCDate()-1);
 while(d.getUTCDay()===0||d.getUTCDay()===6)d.setUTCDate(d.getUTCDate()-1);
 return d.toISOString().slice(0,10);
}
export function validBars(result,{startDate,endDate}) {
 const byDate=new Map();
 for(const b of result?.bars||[]){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(b.date||'')||b.date<startDate||b.date>endDate)continue;
  if(!Number.isFinite(Number(b.open))||Number(b.open)<=0||!Number.isFinite(Number(b.close))||Number(b.close)<=0)continue;
  byDate.set(b.date,b);
 }
 return [...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
export async function mapConcurrent(items,limit,fn) {
 let cursor=0;
 await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{
  while(cursor<items.length){const index=cursor++;await fn(items[index],index);}
 }));
}
