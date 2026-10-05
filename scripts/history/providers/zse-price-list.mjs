const ROOT='https://rest.zse.hr/web/Bvt9fe2peQ7pwpyYqODM/';
const cache=new Map();
const parseCsvLine=s=>{const out=[];let v='',q=false;for(let i=0;i<s.length;i++){const ch=s[i];if(ch==='"'){if(q&&s[i+1]==='"'){v+='"';i++}else q=!q}else if(ch===','&&!q){out.push(v);v=''}else v+=ch}out.push(v);return out};
const iso=d=>d.toISOString().slice(0,10);
const weekdays=(a,b)=>{const out=[],d=new Date(a+'T00:00:00Z'),e=new Date(b+'T00:00:00Z');for(;d<=e;d.setUTCDate(d.getUTCDate()+1)){const w=d.getUTCDay();if(w!==0&&w!==6)out.push(iso(d))}return out};
async function loadDate(date){if(cache.has(date))return cache.get(date);const u=ROOT+'price-list/XZAG/'+date+'/csv?language=EN';try{const r=await fetch(u,{headers:{'user-agent':'Mozilla/5.0 Koersplein/1.0',accept:'text/csv,*/*'}});if(!r.ok){cache.set(date,[]);return []}const t=await r.text(),ls=t.trim().split(/\r?\n/);if(ls.length<2){cache.set(date,[]);return []}const h=parseCsvLine(ls[0]).map(x=>x.trim());const rows=ls.slice(1).map(parseCsvLine).map(a=>Object.fromEntries(h.map((k,i)=>[k,a[i]??''])));cache.set(date,rows);return rows}catch{cache.set(date,[]);return []}}
export class ZsePriceListProvider{
 id='zse-price-list';
 supports(i){return String(i?.mic||'').toUpperCase()==='XZAG'&&Boolean(i?.isin)}
 async fetchDaily(i,{startDate='1997-01-01',endDate=new Date().toISOString().slice(0,10)}={}){
  if(startDate<'1997-01-01')startDate='1997-01-01';const dates=weekdays(startDate,endDate),bars=[];
  for(let n=0;n<dates.length;n+=30){const batch=dates.slice(n,n+30),all=await Promise.all(batch.map(loadDate));for(let j=0;j<all.length;j++){for(const x of all[j]){if(String(x.isin||'').toUpperCase()!==String(i.isin).toUpperCase())continue;const num=k=>Number(String(x[k]||'').replace(',','.'));const open=num('open_price'),high=num('high_price'),low=num('low_price'),close=num('close_price');if(![open,high,low,close].every(Number.isFinite)||close<=0)continue;bars.push({date:x.trade_date||x.date||batch[j],open,high,low,close,volume:Number(x.volume)||0})}}}
  const unique=[...new Map(bars.map(x=>[x.date,x])).values()].sort((a,b)=>a.date.localeCompare(b.date));if(!unique.length)throw new Error('Geen officiële ZSE-historie voor '+i.isin);return {bars:unique,meta:{source:'Zagreb Stock Exchange official daily price lists',root:ROOT}}
 }
}
