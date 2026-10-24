import fs from 'node:fs/promises';
import {budapestClosedSessionStatus,BUDAPEST_CALENDAR_URL} from './providers/budapest-holiday.mjs';
import {fetchMseOfficialPriceList,mseOfficialNoTradeStatus,MSE_PRICE_LIST_URL} from './providers/mse-official-price-list.mjs';
import {BseSofiaProvider,bseOfficialIdentity,bseSessionSnapshot} from './providers/bse-sofia.mjs';
import {euronextDailySnapshot} from './providers/euronext-live.mjs';
import {zseDailySnapshot} from './providers/zse-price-list.mjs';
const cache=new Map();
const clean=s=>String(s||'').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/\s+/g,' ').trim();
const number=s=>{const t=clean(s).replace(/,/g,'');return t&&t!=='-'&&Number.isFinite(Number(t))?Number(t):null;};
const iso=s=>{const m=clean(s).match(/^(\d{2})\.(\d{2})\.(\d{4})$/);return m?`${m[3]}-${m[2]}-${m[1]}`:null;};
// The live Baltic statistics page can roll forward before yesterday's audit.
// A newer snapshot may prove NO_TRADES only when its last trade predates the
// target session. It can never be used as a historical TRADED OHLC source.
function boundedBalticSnapshot(snapshotDate,targetDate){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(targetDate||'')))return false;
 const targetMs=Date.parse(targetDate+'T00:00:00Z');
 if(!Number.isFinite(targetMs)||new Date(targetMs).toISOString().slice(0,10)!==targetDate)return false;
 const lag=(Date.parse(snapshotDate+'T00:00:00Z')-targetMs)/86400000;
 return Number.isInteger(lag)&&lag>=0&&lag<=7;
}
export function parseBalticStatistics(html,date,{allowLaterNoTrade=false}={}){
 const asOf=html.match(/name="end"[^>]*data-value="(\d{4}-\d{2}-\d{2})"/i)?.[1];
 const exact=asOf===date;
 if(!exact&&!(allowLaterNoTrade&&boundedBalticSnapshot(asOf,date)))throw Error('Baltic official snapshot date mismatch: '+asOf+' != '+date);
 const result=new Map();
 for(const table of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)){
  if(!/Last price date/.test(table[1])||!/Open price/.test(table[1]))continue;
  for(const row of table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
   const isin=row[1].match(/\/instrument\/([A-Z]{2}[A-Z0-9]{10})\/trading/)?.[1];
   const raw=[...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(x=>x[1]);
   if(!isin||raw.length!==10)continue;
   const cells=raw.map(clean),lastTradeDate=iso(cells[4]),trades=number(cells[7]),volume=number(cells[8]);
   const mic={VLN:'XLIT',RIG:'XRIS',TLN:'XTAL',TAL:'XTAL'}[cells[1]];
   if(!mic||!lastTradeDate||lastTradeDate>asOf)continue;
   const common={date,mic,isin,lastTradeDate,snapshotDate:asOf,trades,volume,provider:'nasdaq-baltic-official'};
   if(trades===0&&volume===0&&lastTradeDate<date){result.set(isin,{...common,status:'NO_TRADES'});continue;}
   const close=number(cells[3]),open=number(cells[5]),hl=raw[6].split(/<br\s*\/?\s*>/i).map(number).filter(x=>x!==null);
   if(exact&&lastTradeDate===date&&trades>0&&volume>0&&open>0&&close>0)result.set(isin,{...common,status:'TRADED',bar:{date,open,high:hl[0]??null,low:hl[1]??null,close,volume}});
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
 if(mic==='XBUD'){
  // Read-only official market-closure evidence; no invented daily prices.
  const approved=await cached('budapest-calendar-approval',async()=>{
   const registry=JSON.parse(await fs.readFile('data/market-source-registry.json','utf8'));
   const route=registry.markets?.XBUD?.officialNoTradeEvidence;
   return registry.markets?.XBUD?.status==='APPROVED'&&route?.status==='APPROVED_READ_ONLY_NO_TRADE'&&
    route.provider==='bse-budapest-calendar'&&route.sourceUrl===BUDAPEST_CALENDAR_URL;
  });
  return approved?budapestClosedSessionStatus({...instrument,mic,isin},date):null;
 }
 if(mic==='XMAL'){
  // MSE price list has no opening price. Its approved scope is solely to
  // confirm a last-traded date before the exact completed session.
  const approved=await cached('mse-no-trade-approval',async()=>{
   const registry=JSON.parse(await fs.readFile('data/market-source-registry.json','utf8'));
   const route=registry.markets?.XMAL?.officialNoTradeEvidence;
   return route?.status==='APPROVED_READ_ONLY_NO_TRADE'&&route.provider==='mse-official-price-list'&&route.sourceUrl===MSE_PRICE_LIST_URL;
  });
  if(!approved)return null;
  const snapshot=await cached('mse-official:'+date,async()=>{
   try{return await fetchMseOfficialPriceList(date)}
   catch(error){console.warn('MSE_OFFICIAL_NO_TRADE_EVIDENCE_UNAVAILABLE',String(error.message).slice(0,180));return null;}
  });
  return mseOfficialNoTradeStatus(snapshot,{...instrument,mic,isin},date);
 }
 if(mic==='XBUL'){
  const symbol=String(instrument.symbol||instrument.ticker||'').toUpperCase();
  // The official chart can return zero rows for a valid, illiquid equity.
  // That is NOT proof of no trades: verify the official ISIN, quote currency,
  // listed market and the complete dated session table independently.
  let r=null,verified=null;
  try{
   r=await cached(`bse:${isin}:${date}`,()=>new BseSofiaProvider().fetchDaily({...instrument,mic,isin},{startDate:'1990-01-01',endDate:date,signal:AbortSignal.timeout(20000)}));
   verified=r.providerMeta;
  }catch(error){
   if(error.message!=='BSE no traded daily bars in requested range')throw error;
   verified=await cached(`bse-identity:${symbol}`,()=>bseOfficialIdentity(symbol,AbortSignal.timeout(20000)));
  }
  if(!verified||verified.isin!==isin||verified.symbol!==symbol||
    verified.currency!==instrument.currency)return null;
  const bar=r?.bars.find(x=>x.date===date);
  const common={date,mic,isin,provider:'bse-sofia-official',retrievedAt:new Date().toISOString()};
  if(bar)return {...common,status:'TRADED',lastTradeDate:date,bar,sourceUrl:r.requestUrl};
  const session=await cached('bse-session:'+date,()=>bseSessionSnapshot(date,AbortSignal.timeout(20000)));
  if(!session.markets.has(verified.market)||session.symbols.has(symbol))return null;
  const last=r?.bars.at(-1)?.date||null;
  // With no historical bars the source cannot establish a last-trade date.
  // The caller's isVerifiedNoTradeGap gate then permits this only when the
  // stored last bar is exactly the previous closed weekday, never for a stale
  // multi-day/month gap. No price or last-trade date is fabricated.
  if(last&&last>=date)return null;
  return {...common,status:'NO_TRADES',lastTradeDate:last,trades:0,volume:0,
   sourceUrl:session.sourceUrl,sessionSourceUrl:session.sourceUrl,
   verification:'NO_TRADES_IN_COMPLETE_OFFICIAL_SESSION_RESULTS'};
 }
 if(mic==='XZAG'){
  const s=await cached('zse:'+date,()=>zseDailySnapshot(date,AbortSignal.timeout(20000)));
  const status=zseRowStatus(s.rows.find(x=>x.isin===isin),date);
  return status?{...status,sourceUrl:s.sourceUrl,retrievedAt:new Date().toISOString()}:null;
 }
 if(['XTAL','XRIS','XLIT'].includes(mic)){
  const sourceUrl='https://nasdaqbaltic.com/statistics/en/statistics/stats_json';
  const rows=await cached('baltic:'+date,async()=>{const r=await fetch(sourceUrl,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Nasdaq Baltic statistics HTTP '+r.status);return parseBalticStatistics(await r.text(),date,{allowLaterNoTrade:true});});
  const status=rows.get(isin);
  return status&&status.mic===mic?{...status,sourceUrl,retrievedAt:new Date().toISOString()}:null;
 }
 if(['XAMS','XBRU','XPAR','ALXP','XMLI','XMIL','MTAA','EXGM','XOSL','XOAS','MERK','XLIS','ALXL','ENXL','XDUB','XMSM','XESM','XATL'].includes(mic)){
  const snapshot=await cached(`euronext:${mic}:${isin}:${date}`,()=>euronextDailySnapshot({...instrument,mic,isin},date,AbortSignal.timeout(20000)));
  const row=snapshot.rows.find(x=>x.date===date);
  if(!row)return null;
  const common={date,mic,isin,provider:'euronext-live',sourceUrl:snapshot.sourceUrl,retrievedAt:new Date().toISOString(),lastTradeDate:null};
  if(row.volume===0&&row.open===null&&row.close>0)return {...common,status:'NO_TRADES',trades:0,volume:0};
  // Euronext can publish a reference price without an executed trade.
  // Require positive reported volume before asserting TRADED.
  if(row.open>0&&row.close>0&&Number(row.volume)>0)return {...common,status:'TRADED',lastTradeDate:date,bar:row};
 }
 return null;
}
