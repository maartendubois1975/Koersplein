// Canonical, bounded session planning: prioritize freshness and rotate historical backfill.
// No per-instrument stale minimum can prevent the newest trading session from being fetched.
const parseDay = value => {
 if(typeof value!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value))throw Error('Invalid ISO session');
 const d=new Date(value+'T00:00:00Z');
 if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==value)throw Error('Invalid ISO session');
 return d;
};
const iso=d=>d.toISOString().slice(0,10);
export function tradingSessionsAfter(from,through){
 const start=parseDay(from),end=parseDay(through),days=[];
 for(const d=new Date(start);d<end;){d.setUTCDate(d.getUTCDate()+1);if(d.getUTCDay()!==0&&d.getUTCDay()!==6)days.push(iso(d));}
 return days;
}
export function planAmsterdamImport(lastDates,end,{recentLimit=3,rotationDate=end}={}){
 parseDay(end);parseDay(rotationDate);
 if(!Array.isArray(lastDates)||lastDates.length!==80||lastDates.some(x=>typeof x!=='string'))throw Error('Expected 80 dated instruments');
 if(!Number.isSafeInteger(recentLimit)||recentLimit<1||recentLimit>10)throw Error('Invalid recent limit');
 const unique=[...new Set(lastDates.flatMap(d=>tradingSessionsAfter(d,end)))].sort();
 const recent=unique.slice(-recentLimit),backlog=unique.slice(0,-recentLimit);
 // One rotating historical date per calendar day, with no state or duplicate scheduler.
 // This does not guarantee completeness for non-trading/holiday sessions; missing data
 // remains explicitly unverified and never becomes a fabricated OHLC bar.
 const dayNumber=Math.floor(parseDay(rotationDate).getTime()/86400000);
 const historical=backlog.length?[backlog[dayNumber%backlog.length]]:[];
 const sessions=[...new Set([...historical,...recent])].sort();
 return {end,oldest:[...lastDates].sort()[0],pendingSessions:unique.length,
   sessions,deferredSessions:unique.length-sessions.length,
   recentSessions:recent.length,backfillSessions:historical.length,
   policy:'RECENT_FIRST_ROTATING_BACKFILL'};
}
