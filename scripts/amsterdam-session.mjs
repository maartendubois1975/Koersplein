export const marketDate = (now = new Date()) => new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Amsterdam', year:'numeric', month:'2-digit', day:'2-digit'}).format(now);

export const sessionCutoffHour = 20;

export const marketHour = (now = new Date()) => Number(new Intl.DateTimeFormat('en-GB', {timeZone:'Europe/Amsterdam',hour:'2-digit',hourCycle:'h23'}).format(now));

export function latestCandidateSession(now=new Date()) {
 const day=new Date(marketDate(now)+'T00:00:00Z');
 if(marketHour(now)<sessionCutoffHour)day.setUTCDate(day.getUTCDate()-1);
 while(day.getUTCDay()===0||day.getUTCDay()===6)day.setUTCDate(day.getUTCDate()-1);
 return day.toISOString().slice(0,10);
}
