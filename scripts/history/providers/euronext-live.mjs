const PROVIDER_ID='euronext-live';
const ROOT='https://live.euronext.com/en/ajax/getHistoricalPricePopup/';
const clean=s=>String(s??'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').trim();
const iso=s=>{const m=clean(s).match(/(\d{2})\/(\d{2})\/(\d{4})/);return m?`${m[3]}-${m[2]}-${m[1]}`:null};
const num=s=>{const n=Number(clean(s).replace(/\s/g,'').replace(/,/g,''));return Number.isFinite(n)?n:null};
export class EuronextLiveProvider{
 id=PROVIDER_ID;name='Euronext Live historical prices';requiresApiKey=false;
 supports(i){return ['XPAR','ALXP','XMLI','XMIL','MTAA','EXGM','XOSL','XOAS','MERK'].includes(String(i.mic||i.market||'').toUpperCase())&&Boolean(i.isin)}
 async fetchDaily(i,{startDate,endDate,signal}={}){
  const mic=String(i.mic||i.market||'').toUpperCase(),key=`${i.isin}-${mic}`;
  const body=new URLSearchParams({adjusted:'Y',startdate:startDate,enddate:endDate,nbSession:'100000'});
  const r=await fetch(ROOT+encodeURIComponent(key),{method:'POST',signal,headers:{Accept:'*/*','Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest','User-Agent':'Koersplein-history/1.0'},body});
  if(!r.ok)throw Error(`Euronext HTTP ${r.status} voor ${key}`);
  const html=await r.text(),rows=[...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map(x=>[...x[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(y=>clean(y[1])));
  const header=rows.findIndex(row=>row.some(v=>/^date$/i.test(v)));if(header<0)throw Error('Euronext historische tabel ontbreekt');
  const h=rows[header].map(x=>x.toLowerCase()),idx=n=>h.findIndex(x=>x.includes(n));
  const di=idx('date'),oi=idx('open'),hi=idx('high'),li=idx('low'),ci=idx('close'),vi=idx('number of shares');
  const bars=rows.slice(header+1).map(row=>({date:iso(row[di]),open:num(row[oi]),high:num(row[hi]),low:num(row[li]),close:num(row[ci]),adjustedClose:num(row[ci]),volume:vi>=0?num(row[vi]):null})).filter(x=>x.date&&x.close!==null&&x.close>0).sort((a,b)=>a.date.localeCompare(b.date));
  const dedup=[...new Map(bars.map(x=>[x.date,x])).values()];if(!dedup.length)throw Error(`Geen Euronext koershistorie voor ${key}`);
  return{bars:dedup,requestUrl:ROOT+key,providerMeta:{mic,isin:i.isin,source:'Euronext Live'}};
 }
}
