// Research-only Yahoo daily-bar probe. No licensed import, source approval or COMPLETE claim.
import {validateDailyOHLCV} from './usa-ohlcv-validation.mjs';
export const SAMPLES=[
 {mic:'XNYS',symbol:'MMM',providerTicker:'MMM',category:'large'},
 {mic:'XNYS',symbol:'AMC',providerTicker:'AMC',category:'small'},
 {mic:'XNYS',symbol:'RDDT',providerTicker:'RDDT',category:'recent'},
 {mic:'XNYS',symbol:'BRK.B',providerTicker:'BRK-B',category:'share_class_explicit_route'},
 {mic:'XNAS',symbol:'AAPL',providerTicker:'AAPL',category:'large'},
 {mic:'XNAS',symbol:'SOUN',providerTicker:'SOUN',category:'small'},
 {mic:'XNAS',symbol:'PLTR',providerTicker:'PLTR',category:'recent_growth'},
 {mic:'XNAS',symbol:'GOOG',providerTicker:'GOOG',category:'share_class'},
 {mic:'TXSE',symbol:'TCBI',providerTicker:'TCBI',category:'txse_listed_flag'},
 {mic:'TXSE',symbol:'DDS',providerTicker:'DDS',category:'txse_listed_flag'}
];
const fmt=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function parts(date){return Object.fromEntries(fmt.formatToParts(date).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));}
export function newYorkDate(date){const p=parts(date);return p.year+'-'+p.month+'-'+p.day;}
function shift(day,n){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function weekday(day){return new Date(day+'T12:00:00Z').getUTCDay();}
function nth(y,m,w,n){let d=y+'-'+String(m).padStart(2,'0')+'-01';return shift(d,(w-weekday(d)+7)%7+7*(n-1));}
function last(y,m,w){const first=m===12?(y+1)+'-01-01':y+'-'+String(m+1).padStart(2,'0')+'-01';const end=shift(first,-1);return shift(end,-(weekday(end)-w+7)%7);}
function observed(y,m,d,friday=true){const day=y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');const w=weekday(day);return w===0?shift(day,1):w===6&&friday?shift(day,-1):day;}
function easter(y){const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k+7)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31),day=(h+l-7*m+114)%31+1;return y+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');}
export function standardNYSEHoliday(day){
 const y=Number(day.slice(0,4));if(!Number.isInteger(y))return false;
 const h=new Set([observed(y,1,1,false),nth(y,1,1,3),nth(y,2,1,3),shift(easter(y),-2),last(y,5,1),observed(y,6,19),observed(y,7,4),nth(y,9,1,1),nth(y,11,4,4),observed(y,12,25)]);
 // If next January 1 falls on Sunday, the observed Monday belongs to this next year.
 return h.has(day);
}
export function previousSession(day){let d=shift(day,-1);for(let i=0;i<15;i++,d=shift(d,-1))if(weekday(d)!==0&&weekday(d)!==6&&!standardNYSEHoliday(d))return d;throw Error('NO_PREVIOUS_SESSION');}
export function lastFullSession(now=new Date()){
 const p=parts(now);let day=p.year+'-'+p.month+'-'+p.day;
 // Conservative 17:00 New York cutoff; early closes and exceptional closures still require official calendar verification.
 if(Number(p.hour)<17)day=shift(day,-1);
 for(let i=0;i<15;i++,day=shift(day,-1))if(weekday(day)!==0&&weekday(day)!==6&&!standardNYSEHoliday(day))return day;
 throw Error('NO_COMPLETED_SESSION');
}
const expectedExchange={XNYS:['NYQ'],XNAS:['NMS','NGM','NCM'],TXSE:['TEX']};
export function inspectYahooChart(body,{mic,providerTicker,session,previous}){
 const result=body?.chart?.result?.[0],meta=result?.meta||{};
 const details={providerExchange:meta.exchangeName||null,providerFullExchange:meta.fullExchangeName||null,providerSymbol:meta.symbol||null,providerCurrency:meta.currency||null,providerType:meta.instrumentType||null,providerTimezone:meta.exchangeTimezoneName||null};
 const fail=status=>({status,...details,date:null,open:null,close:null});
 if(body?.chart?.error||!result)return fail('NO_PROVIDER_RESULT');
 if(meta.symbol!==providerTicker)return fail('PROVIDER_SYMBOL_MISMATCH');
 if(!expectedExchange[mic]?.includes(meta.exchangeName)||(mic==='TXSE'&&meta.fullExchangeName!=='TXSE'))return fail('PROVIDER_MARKET_MISMATCH');
 if(meta.currency!=='USD'||meta.instrumentType!=='EQUITY'||meta.exchangeTimezoneName!=='America/New_York')return fail('PROVIDER_IDENTITY_MISMATCH');
 const times=result.timestamp||[],q=result.indicators?.quote?.[0];
 if(!Array.isArray(times)||!q)return fail('NO_PROVIDER_QUOTE');
 const found=[];
 for(let i=0;i<times.length;i++){
  if(!Number.isFinite(times[i]))continue;
  const date=newYorkDate(new Date(times[i]*1000));
  if(date!==session&&date!==previous)continue;
  found.push({date,open:q.open?.[i],high:q.high?.[i],low:q.low?.[i],close:q.close?.[i],volume:q.volume?.[i]});
 }
 const target=found.filter(b=>b.date===session),old=found.filter(b=>b.date===previous);
 if(target.length>1||old.length>1)return fail('DUPLICATE_SESSION_BAR');
 const bar=target[0]||old[0];if(!bar)return fail('NO_DATED_BAR');
 try{validateDailyOHLCV([bar],{start:previous,end:session});}catch(e){return {...fail('INVALID_OHLCV'),validationError:String(e.message).slice(0,100)};}
 return {status:bar.date===session?'DATED_OHLC_RESEARCH_ONLY':'PREVIOUS_SESSION_ONLY',...details,date:bar.date,open:bar.open,high:bar.high,low:bar.low,close:bar.close,volume:bar.volume};
}
