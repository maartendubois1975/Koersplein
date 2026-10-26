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
export function tradedBarDefect(bar){
 if(!bar||!validDate(bar.date))return 'INVALID_SESSION_DATE';
 if(bar.currency!==undefined&&bar.currency!==null&&bar.currency!==''&&!/^[A-Za-z]{3}$/.test(String(bar.currency)))return 'INVALID_BAR_CURRENCY';
 const [open,high,low,close]=['open','high','low','close'].map(k=>positiveNumber(bar[k]));
 if([open,high,low,close].some(v=>v===null)||high<Math.max(open,close)||low>Math.min(open,close))return 'INCOMPLETE_OR_INVALID_OHLC';
 if(bar.volume===0||bar.volume==='0')return 'ZERO_VOLUME_REFERENCE_BAR';
 if(bar.volume===null||bar.volume===undefined||bar.volume==='')return 'MISSING_VOLUME';
 if(positiveNumber(bar.volume)===null)return 'INVALID_VOLUME';
 return null;
}
export function validTradedBar(bar){return tradedBarDefect(bar)===null;}
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
 return share=>{
  const venue=String(share.mic||mic).trim().toUpperCase();
  // A foreign MIC embedded in the catalog must not redirect a requested XAMS audit
  // to another exchange's history, even when its ISIN and ticker are identical.
  if(venue!==String(mic).trim().toUpperCase())return null;
  const id=byListing.get(listingKey(venue,share.symbol||share.ticker));
  const official=String(share.isin||'').trim().toUpperCase();
  // The manifest itself may be corrupt or stale: a matching MIC/ticker and
  // storage key must not override a contradictory instrument ISIN.
  const manifestIsin=String(manifest.instruments[id]?.isin||'').trim().toUpperCase();
  if(manifestIsin&&![official,venue+':'+official].includes(manifestIsin)&&!(id===share.legacyStorageIsin&&manifestIsin===String(id).toUpperCase()))return null;
  // A reused ticker does not prove the same security; legacy storage needs an explicit link.
  return id&&(id===official||id===venue+':'+official||id===share.legacyStorageIsin)?id:null;
 };
}
export function weekBars(bars,dates,expectedCurrency=null){
 const expected=new Set(dates),groups=new Map();
 for(const bar of Array.isArray(bars)?bars:[]){
  if(!expected.has(bar?.date))continue;
  if(!groups.has(bar.date))groups.set(bar.date,[]);
  groups.get(bar.date).push(bar);
 }
 const result=new Map(),conflicts=[];
 for(const [date,items] of groups){
  // Reject a per-bar trading currency that contradicts the verified instrument.
  // Older bars with no currency field retain the instrument-level currency gate.
  const currency=String(expectedCurrency||'').trim().toUpperCase();
  const defects=items.map(bar=>tradedBarDefect(bar)||(
   currency&&bar.currency!==undefined&&bar.currency!==null&&bar.currency!==''&&
   String(bar.currency).trim().toUpperCase()!==currency?'BAR_CURRENCY_MISMATCH':null
  )).filter(Boolean);
  if(defects.length){conflicts.push({date,reason:new Set(defects).size===1?defects[0]:'MIXED_INVALID_BAR_TYPES'});continue;}
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
   const venue=String(share.mic||mic).trim().toUpperCase();
   // The Amsterdam catalog currently omits quote currency. Do not silently
   // publish a USD history as EUR under the XAMS/EUR heading.
   const expectedCurrency=String(share.currency||(String(mic).toUpperCase()==='XAMS'?'EUR':'')).trim().toUpperCase();
   const row={share,storageId:id,bars:new Map(),conflicts:[],error:null,provider:null,currency:expectedCurrency||null,lastStoredDate:null};
   rows[index]=row;
   if(venue!==String(mic).trim().toUpperCase()){row.error='CATALOG_MIC_MISMATCH';continue;}
   if(!id){row.error='NO_MATCHING_MIC_TICKER_HISTORY';continue;}
   try{
    // Cloudflare route matches literal MIC colon; %3A in the URL path produces 404.
    if(!/^[A-Z0-9][A-Z0-9:-]{2,31}$/.test(id)){row.error='INVALID_STORAGE_KEY';continue;}
    const response=await fetchImpl(apiBase.replace(/\/$/,'')+'/api/history/'+encodeURIComponent(id).replace(/%3A/gi,':'),{cache:'no-store',signal:AbortSignal.timeout(30000)});
    if(!response.ok){row.error='HISTORY_HTTP_'+response.status;continue;}
    const data=await response.json();
    if(String(data.instrument?.mic||'').toUpperCase()!==String(mic).toUpperCase()||
       String(data.instrument?.symbol||'').toUpperCase()!==String(share.symbol||share.ticker||'').toUpperCase()){
     row.error='HISTORY_LISTING_IDENTITY_MISMATCH';continue;
    }
    // A matching MIC and ticker alone cannot prove security identity after ticker reuse.
    // Legacy keys are accepted only when explicitly linked by the catalog.
    const storedIsin=String(data.instrument?.isin||'').trim().toUpperCase();
    const expectedIsin=String(share.isin||'').trim().toUpperCase();
    // Missing ISIN is not a verified listing identity. MIC + ticker can be
    // reused by another security, so fail closed even for legacy storage keys.
    if(!storedIsin||![expectedIsin,String(mic).toUpperCase()+':'+expectedIsin,String(id).toUpperCase()].includes(storedIsin)){
     row.error='HISTORY_ISIN_IDENTITY_MISMATCH';continue;
    }
    const storedCurrency=String(data.instrument?.currency||'').trim().toUpperCase();
    // Unknown currency is not proof of EUR: do not label an unverified
    // currency as EUR merely because the Amsterdam catalog defaults to it.
    if(expectedCurrency&&storedCurrency!==expectedCurrency){
     row.error='HISTORY_CURRENCY_MISMATCH';continue;
    }
    row.lastStoredDate=validDate(data.coverage?.lastDate)?data.coverage.lastDate:null;
    const found=weekBars(data.bars,dates,expectedCurrency);row.bars=found.bars;row.conflicts=found.conflicts;
    row.provider=data.provider?.name||null;row.currency=data.instrument?.currency||row.currency;
   }catch(e){row.error=e?.name==='TimeoutError'?'HISTORY_TIMEOUT':'HISTORY_FETCH_ERROR';}
  }
 }));
 return {mic,dates,rows,coverage:weekCoverage(rows,dates)};
}

/**
 * Status-only historical audit. This is never a synthetic price or volume bar.
 * An explicit audited ISIN + MIC + date is required; a missing bar is not proof.
 */
export function verifiedNoTradeStatus(audit,share,mic,date,week){
 if(!audit||audit.schemaVersion!==1||audit.mic!==mic||audit.scope!=='OFFICIAL_NO_TRADES_STATUS_ONLY_NO_PRICE_DATA')return false;
 if(!Array.isArray(week)||!Array.isArray(audit.week)||week.length!==audit.week.length||week.some((d,i)=>d!==audit.week[i]))return false;
 if(!/^[a-f0-9]{40}$/i.test(String(audit.auditCommit||''))||!/^[0-9]+$/.test(String(audit.auditRun||'')))return false;
 if(!validDate(date)||!week.includes(date)||String(share?.mic||mic).toUpperCase()!==mic)return false;
 const isin=String(share?.isin||'').toUpperCase();
 const ticker=String(share?.symbol||share?.ticker||'').trim().toUpperCase();
 // A historical status is tied to the audited listing, not only its ISIN:
 // the same security may have a different symbol or a reused ticker.
 return /^[A-Z]{2}[A-Z0-9]{10}$/.test(isin)&&ticker.length>0&&
  String(audit.tickers?.[isin]||'').trim().toUpperCase()===ticker&&
  Array.isArray(audit.noTrades?.[isin])&&audit.noTrades[isin].includes(date);
}
