// Shared read-only market-week contract for the public site and production audits.
// A listing is identified by MIC + ticker, never by a globally shared ISIN alone.
export const AMSTERDAM_REFERENCE_WEEK=['2026-10-19','2026-10-20','2026-10-21','2026-10-22','2026-10-23'];
const dayPattern=/^\d{4}-\d{2}-\d{2}$/;
export function validDate(value){
 if(typeof value!=='string'||!dayPattern.test(value))return false;
 const date=new Date(value+'T00:00:00Z');
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}
export function positiveNumber(value){
 if(typeof value==='number')return Number.isFinite(value)&&value>0?value:null;
 if(typeof value!=='string'||!/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim()))return null;
 const n=Number(value);return Number.isFinite(n)&&n>0?n:null;
}
export function validTradedBar(bar){
 if(!bar||!validDate(bar.date))return false;
 const [open,high,low,close]=['open','high','low','close'].map(k=>positiveNumber(bar[k]));
 const volume=positiveNumber(bar.volume);
 return [open,high,low,close,volume].every(v=>v!==null)&&high>=Math.max(open,close)&&low<=Math.min(open,close);
}
export function sessionChange(open,close){
 const a=positiveNumber(open),b=positiveNumber(close);
 return a===null||b===null?null:{absolute:b-a,percent:(b/a-1)*100};
}
const listingKey=(mic,ticker)=>String(mic||'').trim().toUpperCase()+'\u0000'+String(ticker||'').trim().toUpperCase();
export function manifestResolver(manifest,mic){
 if(!manifest||!manifest.instruments||typeof manifest.instruments!=='object'||Array.isArray(manifest.instruments))throw Error('INVALID_PUBLIC_MANIFEST');
 const byListing=new Map();
 for(const [id,row] of Object.entries(manifest.instruments)){
  if(!row?.mic||!row?.symbol)continue;
  const key=listingKey(row.mic,row.symbol);
  if(byListing.has(key)&&byListing.get(key)!==id)byListing.set(key,null);
  else if(!byListing.has(key))byListing.set(key,id);
 }
 return share=>byListing.get(listingKey(share.mic||mic,share.symbol||share.ticker))||null;
}
export function weekBars(bars,dates){
 const expected=new Set(dates),groups=new Map();
 for(const bar of Array.isArray(bars)?bars:[]){
  if(!expected.has(bar?.date))continue;
  if(!groups.has(bar.date))groups.set(bar.date,[]);
  groups.get(bar.date).push(bar);
 }
 const result=new Map(),conflicts=[];
 for(const [date,items] of groups){
  if(items.some(bar=>!validTradedBar(bar))){conflicts.push({date,reason:'INVALID_OR_ZERO_VOLUME'});continue;}
  const signatures=new Set(items.map(bar=>JSON.stringify(['open','high','low','close','volume'].map(k=>positiveNumber(bar[k])))));
  if(signatures.size!==1){conflicts.push({date,reason:'CONFLICTING_DUPLICATES'});continue;}
  result.set(date,items[0]);
 }
 return {bars:result,conflicts};
}
export function weekCoverage(rows,dates){
 const perDay=Object.fromEntries(dates.map(date=>[date,{valid:0,missing:0}]));
 let complete=0;
 for(const row of rows){
  let full=true;
  for(const date of dates){
   if(row.bars.has(date))perDay[date].valid++;
   else {perDay[date].missing++;full=false;}
  }
  if(full)complete++;
 }
 return {catalog:rows.length,complete,perDay,validSessions:Object.values(perDay).reduce((n,v)=>n+v.valid,0),expectedSessions:rows.length*dates.length};
}
export async function collectMarketWeek({catalog,manifest,apiBase,mic,dates,fetchImpl=globalThis.fetch,concurrency=6}){
 if(!Array.isArray(dates)||dates.length<1||dates.some(d=>!validDate(d))||new Set(dates).size!==dates.length)throw Error('INVALID_WEEK_DATES');
 if(!Array.isArray(catalog)||!mic||!/^https:\/\//.test(apiBase))throw Error('INVALID_WEEK_CONFIG');
 const resolve=manifestResolver(manifest,mic);
 const rows=Array(catalog.length);let cursor=0;
 await Promise.all(Array.from({length:Math.min(concurrency,catalog.length)},async()=>{
  while(cursor<catalog.length){
   const index=cursor++,share=catalog[index],id=resolve(share);
   const row={share,storageId:id,bars:new Map(),conflicts:[],error:null,provider:null,currency:share.currency||null};
   rows[index]=row;
   if(!id){row.error='NO_MATCHING_MIC_TICKER_HISTORY';continue;}
   try{
    const response=await fetchImpl(apiBase.replace(/\/$/,'')+'/api/history/'+encodeURIComponent(id),{cache:'no-store',signal:AbortSignal.timeout(30000)});
    if(!response.ok){row.error='HISTORY_HTTP_'+response.status;continue;}
    const data=await response.json();
    if(String(data.instrument?.mic||'').toUpperCase()!==String(share.mic||mic).toUpperCase()||
       String(data.instrument?.symbol||'').toUpperCase()!==String(share.symbol||share.ticker||'').toUpperCase()){
     row.error='HISTORY_LISTING_IDENTITY_MISMATCH';continue;
    }
    const found=weekBars(data.bars,dates);row.bars=found.bars;row.conflicts=found.conflicts;
    row.provider=data.provider?.name||null;row.currency=data.instrument?.currency||row.currency;
   }catch(e){row.error=e?.name==='TimeoutError'?'HISTORY_TIMEOUT':'HISTORY_FETCH_ERROR';}
  }
 }));
 return {mic,dates,rows,coverage:weekCoverage(rows,dates)};
}
