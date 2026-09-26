const PROVIDER_ID='euronext-live';
const ROOT='https://live.euronext.com/en/ajax/getHistoricalPricePopup/';
const clean=s=>String(s??'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').trim();
const iso=s=>{const m=clean(s).match(/(\d{2})\/(\d{2})\/(\d{4})/);return m?`${m[3]}-${m[2]}-${m[1]}`:null};
const num=s=>{const n=Number(clean(s).replace(/\s/g,'').replace(/,/g,''));return Number.isFinite(n)?n:null};
const addDays=(isoDate,days)=>{const d=new Date(isoDate+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)};
const chunks=(start,end)=>{
 const out=[];let s=start;
 // Euronext's public historical endpoint rejects/omits tables when the requested
 // start is more than ~2 years back. Query bounded windows and merge them instead
 // of interpreting that transport limit as "no history".
 while(s<=end){const eCandidate=addDays(s,700);const e=eCandidate<end?eCandidate:end;out.push([s,e]);if(e===end)break;s=addDays(e,1)}
 return out;
};
const parseTable=html=>{
 const rows=[...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map(x=>[...x[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(y=>clean(y[1])));
 const header=rows.findIndex(row=>row.some(v=>/^date$/i.test(v)));if(header<0)return[];
 const h=rows[header].map(x=>x.toLowerCase()),idx=n=>h.findIndex(x=>x.includes(n));
 const di=idx('date'),oi=idx('open'),hi=idx('high'),li=idx('low'),ci=idx('close'),vi=idx('number of shares');
 return rows.slice(header+1).map(row=>({date:iso(row[di]),open:num(row[oi]),high:num(row[hi]),low:num(row[li]),close:num(row[ci]),adjustedClose:num(row[ci]),volume:vi>=0?num(row[vi]):null})).filter(x=>x.date&&x.close!==null&&x.close>0);
};
export class EuronextLiveProvider{
 id=PROVIDER_ID;name='Euronext Live historical prices';requiresApiKey=false;
 supports(i){return ['XPAR','ALXP','XMLI','XMIL','MTAA','EXGM','XOSL','XOAS','MERK','XLIS','ALXL','ENXL'].includes(String(i.mic||i.market||'').toUpperCase())&&Boolean(i.isin)}
 async fetchDaily(i,{startDate,endDate,signal}={}){
  const mic=String(i.mic||i.market||'').toUpperCase(),key=`${i.isin}-${mic}`,all=[];
  for(const [start,end] of chunks(startDate,endDate)){
   const body=new URLSearchParams({adjusted:'Y',startdate:start,enddate:end,nbSession:'100000'});
   const r=await fetch(ROOT+encodeURIComponent(key),{method:'POST',signal,headers:{Accept:'*/*','Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest','User-Agent':'Koersplein-history/1.0'},body});
   if(!r.ok)throw Error(`Euronext HTTP ${r.status} voor ${key} (${start}..${end})`);
   all.push(...parseTable(await r.text()));
  }
  const dedup=[...new Map(all.map(x=>[x.date,x])).values()].sort((a,b)=>a.date.localeCompare(b.date));
  if(!dedup.length)throw Error(`Geen Euronext koershistorie voor ${key}`);
  return{bars:dedup,requestUrl:ROOT+key,providerMeta:{mic,isin:i.isin,source:'Euronext Live',windowPolicy:'<=700d chunks'}};
 }
}
