// Conservative close boundary for the weekday production run (18:45 UTC).
export function latestClosedWeekday(now=new Date()) {
 const d=new Date(now);if(d.getUTCHours()<18)d.setUTCDate(d.getUTCDate()-1);
 while(d.getUTCDay()===0||d.getUTCDay()===6)d.setUTCDate(d.getUTCDate()-1);
 return d.toISOString().slice(0,10);
}

// One day's missing trade is not proof that a security stopped trading months
// ago. Require a source-reported last trade matching the stored bar, or (when
// the official source cannot report a last-trade date) yesterday's closed
// session as the maximum defensible gap.
export function previousClosedWeekday(date) {
 const d=new Date(date+'T12:00:00Z');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==date)throw Error('Invalid session date '+date);
 do {d.setUTCDate(d.getUTCDate()-1)} while(d.getUTCDay()===0||d.getUTCDay()===6);
 return d.toISOString().slice(0,10);
}
export function isVerifiedNoTradeGap(status,lastStoredDate,cutoff) {
 if(status?.status!=='NO_TRADES'||status.date!==cutoff||!/^\d{4}-\d{2}-\d{2}$/.test(String(lastStoredDate||''))||lastStoredDate>=cutoff)return false;
 if(status.lastTradeDate)return status.lastTradeDate===lastStoredDate;
 return lastStoredDate===previousClosedWeekday(cutoff);
}

// A complete OHLC bar needs all four independently reported prices. Null
// high/low, an inverted range, or a close outside the high/low range must
// never be stored as a valid daily candle or counted as current by the audit.
export function isCompleteOhlcBar(b) {
 if(!b||!/^\d{4}-\d{2}-\d{2}$/.test(String(b.date||'')))return false;
 const d=new Date(b.date+'T00:00:00Z');
 if(Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==b.date)return false;
 const prices=['open','high','low','close'].map(k=>{
  const value=b[k];
  return value===null||value===undefined||value===''?NaN:Number(value);
 });
 if(!prices.every(x=>Number.isFinite(x)&&x>0))return false;
 const [open,high,low,close]=prices;
 return high>=Math.max(open,close)&&low<=Math.min(open,close);
}
export function auditBarIssue(bar,cutoff,today) {
 if(!bar)return 'NO_VALID_BAR';
 if(!isCompleteOhlcBar(bar))return 'INCOMPLETE_OR_INVALID_OHLC';
 if(bar.date>today)return 'FUTURE_LAST_TRADE';
 if(bar.date>cutoff)return 'SESSION_NOT_YET_CLOSED';
 if(bar.date<cutoff)return 'STALE_LAST_TRADE';
 return null;
}
export function validBars(result,{startDate,endDate}) {
 const byDate=new Map();
 for(const b of result?.bars||[]){
  if(!isCompleteOhlcBar(b)||b.date<startDate||b.date>endDate)continue;
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
