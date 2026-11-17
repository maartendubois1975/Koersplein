import fs from 'node:fs/promises';
import {parentMic} from './source-policy.mjs';
import {validSessionDate} from '../../daily-session-view.mjs';
export const tradingCalendars=JSON.parse(await fs.readFile(new URL('../../data/trading-calendars.json',import.meta.url),'utf8'));
export function sessionCalendar(market,date){
 if(!validSessionDate(date))throw Error('INVALID_CALENDAR_DATE');
 const id=tradingCalendars.markets[parentMic(market)],calendar=tradingCalendars.calendars[id];
 if(!calendar)throw Error('MARKET_CALENDAR_NOT_APPROVED '+market);
 const year=calendar.years[date.slice(0,4)];if(!year)throw Error('MARKET_CALENDAR_YEAR_NOT_APPROVED '+date.slice(0,4));
 const weekend=[0,6].includes(new Date(date+'T12:00:00Z').getUTCDay());
 return {date,market:parentMic(market),timezone:calendar.timezone,finalizedAfter:calendar.finalizedAfter,open:!weekend&&!year.closed.includes(date),halfDay:year.halfDays.includes(date),sourceUrl:tradingCalendars.source};
}
export function latestClosedSession(market,now=new Date()){
 const definition=tradingCalendars.calendars[tradingCalendars.markets[parentMic(market)]];if(!definition)throw Error('MARKET_CALENDAR_NOT_APPROVED '+market);
 const timezone=definition.timezone,parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
 let date=parts.year+'-'+parts.month+'-'+parts.day,time=parts.hour+':'+parts.minute;
 for(let i=0;i<15;i++){
  const calendar=sessionCalendar(market,date);
  if(calendar.open&&time>=calendar.finalizedAfter)return date;
  const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-1);date=d.toISOString().slice(0,10);time='23:59';
 }
 throw Error('NO_APPROVED_CLOSED_SESSION '+market);
}
