import {createHash,createDecipheriv} from 'node:crypto';
const PROVIDER_ID='euronext-live';
export const euronextProviderMic=mic=>String(mic||'').toUpperCase()==='XDUB'?'XMSM':String(mic||'').toUpperCase();
const ROOT='https://live.euronext.com/en/ajax/getHistoricalPricePopup/';
const clean=s=>String(s??'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').trim();
const iso=s=>{const m=clean(s).match(/(\d{2})\/(\d{2})\/(\d{4})/);return m?`${m[3]}-${m[2]}-${m[1]}`:null};
// The public table may format decimal prices as 12,34 or 12.34, and group thousands
// as 1,234.56 or 1.234,56. Never turn a decimal comma into a 100x price.
export const parseEuronextNumber=s=>{
 const text=clean(s).replace(/[\u00a0\u202f\s]/g,'');
 if(!text||text==='-')return null;
 let value=text;
 const comma=value.lastIndexOf(','),dot=value.lastIndexOf('.');
 if(comma>=0&&dot>=0){
  value=comma>dot?value.replace(/\./g,'').replace(',','.'):value.replace(/,/g,'');
 }else if(comma>=0){
  value=/^-?\d{1,3}(?:,\d{3})+$/.test(value)?value.replace(/,/g,''):value.replace(',','.');
 }
 if(!/^-?\d+(?:\.\d+)?$/.test(value))return null;
 const n=Number(value);return Number.isFinite(n)?n:null;
};
const num=parseEuronextNumber;
const addDays=(isoDate,days)=>{const d=new Date(isoDate+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)};
const chunks=(start,end)=>{
 const out=[];let s=start;
 // Euronext's public historical endpoint rejects/omits tables when the requested
 // start is more than ~2 years back. Query bounded windows and merge them instead
 // of interpreting that transport limit as "no history".
 while(s<=end){const eCandidate=addDays(s,700);const e=eCandidate<end?eCandidate:end;out.push([s,e]);if(e===end)break;s=addDays(e,1)}
 return out;
};
export const parseEuronextHistoryRows=html=>{
 const rows=[...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map(x=>[...x[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(y=>clean(y[1])));
 const header=rows.findIndex(row=>row.some(v=>/^date$/i.test(v)));if(header<0)return[];
 const h=rows[header].map(x=>x.toLowerCase()),idx=n=>h.findIndex(x=>x.includes(n));
 const di=idx('date'),oi=idx('open'),hi=idx('high'),li=idx('low'),ci=idx('close');
 const vi=h.findIndex(x=>x.includes('number of shares')||x==='volume'||/^vol\.?$/i.test(x.trim())||x.includes('traded volume')||x.includes('quantity traded'));
 if(di<0||oi<0||ci<0)return[];
 return rows.slice(header+1).map(row=>({date:iso(row[di]),open:num(row[oi]),high:num(row[hi]),low:num(row[li]),close:num(row[ci]),adjustedClose:null,volume:vi>=0?num(row[vi]):null})).filter(x=>x.date&&x.close!==null&&x.close>0);
};
// Euronext's public AJAX client uses this published transport format and
// default passphrase (ajax_secure/js/ajax-secure.js); this is not an account credential.
export function decodeEuronextBody(text){
 if(!/^[\s]*[\[{\"]/.test(text))return text;
 let payload;try{payload=JSON.parse(text);}catch{return text;}
 if(payload?.ct&&payload.iv&&payload.s){
  const password=Buffer.from('24ayqVo7yJma'),salt=Buffer.from(payload.s,'hex');
  let previous=Buffer.alloc(0),derived=Buffer.alloc(0);
  while(derived.length<48){previous=createHash('md5').update(Buffer.concat([previous,password,salt])).digest();derived=Buffer.concat([derived,previous]);}
  const decipher=createDecipheriv('aes-256-cbc',derived.subarray(0,32),Buffer.from(payload.iv,'hex'));
  payload=JSON.parse(Buffer.concat([decipher.update(Buffer.from(payload.ct,'base64')),decipher.final()]).toString('utf8'));
 }
 const html=[];const collect=x=>{if(typeof x==='string'&&x.includes('<'))html.push(x);else if(x&&typeof x==='object')for(const v of Object.values(x))collect(v);};collect(payload);
 if(!html.length)throw Error('EURONEXT_TRANSPORT_NO_HTML');
 return html.join('\n');
}
export async function euronextDailySnapshot(i,date,signal){
 const key=`${i.isin}-${euronextProviderMic(i.mic)}`,sourceUrl=ROOT+encodeURIComponent(key);
 const r=await fetch(sourceUrl,{method:'POST',signal,headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest'},body:new URLSearchParams({adjusted:'Y',startdate:date,enddate:date,nbSession:'100000'})});
 if(!r.ok)throw Error('Euronext HTTP '+r.status);
 return {sourceUrl,rows:parseEuronextHistoryRows(decodeEuronextBody(await r.text()))};
}
export class EuronextLiveProvider{
 id=PROVIDER_ID;name='Euronext Live historical prices';requiresApiKey=false;
 supports(i){return ['XAMS','XBRU','XDUB','XMSM','XESM','XATL','XPAR','ALXP','XMLI','XMIL','MTAA','EXGM','XOSL','XOAS','MERK','XLIS','ALXL','ENXL'].includes(String(i.mic||i.market||'').toUpperCase())&&Boolean(i.isin)}
 async fetchDaily(i,{startDate,endDate,signal}={}){
  const mic=euronextProviderMic(i.mic||i.market),key=`${i.isin}-${mic}`,all=[];
  const failedWindows=[];
  for(const [start,end] of chunks(startDate,endDate)){
   try{
    const body=new URLSearchParams({adjusted:'Y',startdate:start,enddate:end,nbSession:'100000'});
    const r=await fetch(ROOT+encodeURIComponent(key),{method:'POST',signal,headers:{Accept:'*/*','Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest','User-Agent':'Koersplein-history/1.0'},body});
    if(!r.ok)throw Error(`Euronext HTTP ${r.status}`);
    all.push(...parseEuronextHistoryRows(decodeEuronextBody(await r.text())));
   }catch(error){
    if(signal?.aborted)throw error;
    failedWindows.push({start,end,error:error.message});
   }
  }
  const dedup=[...new Map(all.map(x=>[x.date,x])).values()].sort((a,b)=>a.date.localeCompare(b.date));
  // A reference/indicative price is not proof of an executed trade.
  // The official table's Number of Shares must confirm positive volume.
  const traded=dedup.filter(b=>Number(b.open)>0&&Number(b.close)>0&&Number(b.volume)>0);
  if(!traded.length)throw Error(`Geen verhandelde Euronext koershistorie voor ${key}; mislukte vensters: ${failedWindows.length}`);
  return{bars:traded,requestUrl:ROOT+key,providerMeta:{mic,isin:i.isin,source:'Euronext Live',windowPolicy:'<=700d chunks',partialHistory:failedWindows.length>0,failedWindows}};
 }
}
