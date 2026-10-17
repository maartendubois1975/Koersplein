import {BseSofiaProvider} from './providers/bse-sofia.mjs';
import {euronextDailySnapshot} from './providers/euronext-live.mjs';
import {zseDailySnapshot} from './providers/zse-price-list.mjs';
const cache=new Map();
const clean=s=>String(s||'').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/\s+/g,' ').trim();
const number=s=>{const t=clean(s).replace(/,/g,'');return t&&t!=='-'&&Number.isFinite(Number(t))?Number(t):null;};
const iso=s=>{const m=clean(s).match(/^(\d{2})\.(\d{2})\.(\d{4})$/);return m?`${m[3]}-${m[2]}-${m[1]}`:null;};
export function parseBalticStatistics(html,date){
 const asOf=html.match(/name="end"[^>]*data-value="(\d{4}-\d{2}-\d{2})"/i)?.[1];
 if(asOf!==date)throw Error('Baltic official snapshot date mismatch: '+asOf+' != '+date);
 const result=new Map();
 for(const table of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)){
  if(!/Last price date/.test(table[1])||!/Open price/.test(table[1]))continue;
  for(const row of table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
   const isin=row[1].match(/\/instrument\/([A-Z]{2}[A-Z0-9]{10})\/trading/)?.[1];
   const raw=[...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(x=>x[1]);
   if(!isin||raw.length!==10)continue;
   const cells=raw.map(clean),lastTradeDate=iso(cells[4]),trades=number(cells[7]),volume=number(cells[8]);
   const mic={VLN:'XLIT',RIG:'XRIS',TLN:'XTAL',TAL:'XTAL'}[cells[1]];
   if(!mic||!lastTradeDate||lastTradeDate>date)continue;
   const common={date,mic,isin,lastTradeDate,trades,volume,provider:'nasdaq-baltic-official'};
   if(trades===0&&volume===0){result.set(isin,{...common,status:'NO_TRADES'});continue;}
   const close=number(cells[3]),open=number(cells[5]),hl=raw[6].split(/<br\s*\/?\s*>/i).map(number).filter(x=>x!==null);
   if(lastTradeDate===date&&trades>0&&volume>0&&open>0&&close>0)result.set(isin,{...common,status:'TRADED',bar:{date,open,high:hl[0]??null,low:hl[1]??null,close,volume}});
  }
 }
 return result;
}
export function zseRowStatus(row,date){
 if(!row||row.date!==date||!row.trade_date||row.trade_date>date)return null;
 const trades=number(row.num_trades),volume=number(row.volume);
 const common={date,mic:row.mic,isin:row.isin,lastTradeDate:row.trade_date,trades,volume,provider:'zse-price-list'};
 if(trades===0&&volume===0)return {...common,status:'NO_TRADES'};
 const open=number(row.open_price),close=number(row.close_price);
 if(row.trade_date===date&&trades>0&&volume>0&&open>0&&close>0)return {...common,status:'TRADED',bar:{date,open,high:number(row.high_price),low:number(row.low_price),close,volume}};
 return null;
}
async function cached(key,fn){if(!cache.has(key))cache.set(key,fn().catch(e=>{cache.delete(key);throw e;}));return cache.get(key);}
export async function officialDailyStatus(instrument,date){
 const mic=instrument.mic||instrument.market,isin=instrument.officialIsin||instrument.isin;
 if(mic==='XBUL'){
  const r=await cached(`bse:${isin}:${date}`,()=>new BseSofiaProvider().fetchDaily({...instrument,mic,isin},{startDate:date,endDate:date,signal:AbortSignal.timeout(20000)}));
  const bar=r.bars.find(x=>x.date===date);
  return bar?{status:'TRADED',date,mic,isin,lastTradeDate:date,bar,provider:'bse-sofia-official',sourceUrl:r.requestUrl,retrievedAt:new Date().toISOString()}:null;
 }
 if(mic==='XZAG'){
  const s=await cached('zse:'+date,()=>zseDailySnapshot(date,AbortSignal.timeout(20000)));
  const status=zseRowStatus(s.rows.find(x=>x.isin===isin),date);
  return status?{...status,sourceUrl:s.sourceUrl,retrievedAt:new Date().toISOString()}:null;
 }
 if(['XTAL','XRIS','XLIT'].includes(mic)){
  const sourceUrl='https://nasdaqbaltic.com/statistics/en/statistics/stats_json';
  const rows=await cached('baltic:'+date,async()=>{const r=await fetch(sourceUrl,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Nasdaq Baltic statistics HTTP '+r.status);return parseBalticStatistics(await r.text(),date);});
  const status=rows.get(isin);
  return status&&status.mic===mic?{...status,sourceUrl,retrievedAt:new Date().toISOString()}:null;
 }
 if(['XAMS','XBRU','XPAR','ALXP','XMLI','XMIL','MTAA','EXGM','XOSL','XOAS','MERK','XLIS','ALXL','ENXL','XDUB'].includes(mic)){
  const snapshot=await cached(`euronext:${mic}:${isin}:${date}`,()=>euronextDailySnapshot({...instrument,mic,isin},date,AbortSignal.timeout(20000)));
  const row=snapshot.rows.find(x=>x.date===date);
  if(!row)return null;
  const common={date,mic,isin,provider:'euronext-live',sourceUrl:snapshot.sourceUrl,retrievedAt:new Date().toISOString(),lastTradeDate:null};
  if(row.volume===0&&row.open===null&&row.close>0)return {...common,status:'NO_TRADES',trades:0,volume:0};
  if(row.open>0&&row.close>0)return {...common,status:'TRADED',lastTradeDate:date,bar:row};
 }
 return null;
}
