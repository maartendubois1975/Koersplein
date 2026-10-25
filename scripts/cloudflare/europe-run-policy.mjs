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

// Numeric strings from legacy history are permitted, but JavaScript's Number()
// also accepts booleans, arrays, hexadecimal literals and whitespace. None of
// those is evidence of a real traded price. Keep this gate shared by import,
// stored-history diagnostics and source-conflict comparisons.
export function parseOhlcPrice(value) {
 if(typeof value==='number')return Number.isFinite(value)&&value>0?value:null;
 if(typeof value!=='string')return null;
 const text=value.trim();
 if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text))return null;
 const number=Number(text);
 return Number.isFinite(number)&&number>0?number:null;
}
// A complete OHLC bar needs all four independently reported prices. Null
// high/low, an inverted range, or a close outside the high/low range must
// never be stored as a valid daily candle or counted as current by the audit.
export function isCompleteOhlcBar(b) {
 if(!b||!/^\d{4}-\d{2}-\d{2}$/.test(String(b.date||'')))return false;
 const d=new Date(b.date+'T00:00:00Z');
 if(Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==b.date)return false;
 const prices=['open','high','low','close'].map(k=>parseOhlcPrice(b[k]));
 if(prices.some(x=>x===null))return false;
 const [open,high,low,close]=prices;
 return high>=Math.max(open,close)&&low<=Math.min(open,close);
}
export function auditBarIssue(bar,cutoff,today) {
 if(!bar)return 'NO_VALID_BAR';
 if(!isCompleteOhlcBar(bar))return 'INCOMPLETE_OR_INVALID_OHLC';
 // A dated reference candle with zero executed shares is not a traded OHLC.
 if(bar.volume===0)return 'ZERO_VOLUME_REFERENCE_BAR';
 if(bar.date>today)return 'FUTURE_LAST_TRADE';
 if(bar.date>cutoff)return 'SESSION_NOT_YET_CLOSED';
 if(bar.date<cutoff)return 'STALE_LAST_TRADE';
 return null;
}
// Partition order is not authoritative. Prefer a complete OHLC row when two
// stored rows share the latest date, matching recentOhlcDebt's duplicate policy.
// Read-only audit helper; does not modify or merge stored prices.
export function latestAuditBar(bars,maxDate=null) {
 let latest=null;
 for(const bar of bars||[]){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(bar?.date||'')))continue;
  const date=new Date(bar.date+'T00:00:00Z');
  if(Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==bar.date)continue;
  if(maxDate&&bar.date>maxDate)continue;
  if(!latest||bar.date>latest.date||(bar.date===latest.date&&isCompleteOhlcBar(bar)&&!isCompleteOhlcBar(latest)))latest=bar;
 }
 return latest;
}

// Source rows may repeat a session. A last-wins Map would silently choose
// one of two contradictory OHLC candles and could append an arbitrary price.
// Quarantine ONLY the ambiguous date, preserving other independently valid
// dates from the same approved provider response. This is not a price repair.
export function inspectDailyBarIntegrity(result,{startDate,endDate}) {
 const byDate=new Map();
 for(const bar of result?.bars||[]){
  const date=bar?.date;
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<startDate||date>endDate)continue;
  const parsed=new Date(date+'T00:00:00Z');
  if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==date)continue;
  if(!byDate.has(date))byDate.set(date,{complete:[],invalid:0,signatures:new Set()});
  const group=byDate.get(date);
  if(!isCompleteOhlcBar(bar)){group.invalid++;continue;}
  group.complete.push(bar);
  group.signatures.add(JSON.stringify(['open','high','low','close'].map(key=>parseOhlcPrice(bar[key]))));
 }
 const bars=[],conflicts=[];
 for(const [date,group] of byDate){
  const code=group.signatures.size>1?'CONFLICTING_COMPLETE_OHLC':
    group.complete.length&&group.invalid?'MIXED_COMPLETE_INVALID_OHLC':null;
  if(code){
   conflicts.push({date,code,completeRows:group.complete.length,invalidRows:group.invalid});
  }else if(group.complete.length){
   bars.push(group.complete[0]);
  }
 }
 bars.sort((a,b)=>a.date.localeCompare(b.date));
 conflicts.sort((a,b)=>a.date.localeCompare(b.date));
 return {bars,conflicts,readOnly:true};
}
export function validBars(result,range) {
 return inspectDailyBarIntegrity(result,range).bars;
}
// A yearly history partition can straddle the 30-calendar-day audit window
// at New Year. Always include every existing year intersecting that window,
// the most recent closed-year partition (for stale-price classification), and
// the newest partition (to preserve visibility of future-dated stored rows).
// This is strictly read-only; it does not authorize historical corrections.
export function selectEuropeAuditHistoryPeriods(partitions,cutoff,windowDays=30) {
 if(typeof cutoff!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(cutoff)||
    !Number.isFinite(Date.parse(cutoff+'T00:00:00Z'))||
    new Date(cutoff+'T00:00:00Z').toISOString().slice(0,10)!==cutoff||
    !Number.isInteger(windowDays)||windowDays<1||windowDays>366)throw Error('Invalid history audit window');
 const min=new Date(cutoff+'T00:00:00Z');
 min.setUTCDate(min.getUTCDate()-windowDays+1);
 const startYear=min.toISOString().slice(0,4),endYear=cutoff.slice(0,4);
 const periods=(partitions||[]).map(p=>p?.period);
 if(periods.some(p=>typeof p!=='string'||!/^\d{4}$/.test(p)))throw Error('Invalid yearly history partition metadata');
 const sorted=[...new Set(periods)].sort();
 if(!sorted.length)return [];
 const chosen=new Set([sorted.at(-1)]);
 const latestClosed=sorted.filter(p=>p<=endYear).at(-1);
 if(latestClosed)chosen.add(latestClosed);
 for(const period of sorted)if(period>=startYear&&period<=endYear)chosen.add(period);
 return [...chosen].sort();
}

export async function mapConcurrent(items,limit,fn) {
 let cursor=0;
 await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{
  while(cursor<items.length){const index=cursor++;await fn(items[index],index);}
 }));
}
