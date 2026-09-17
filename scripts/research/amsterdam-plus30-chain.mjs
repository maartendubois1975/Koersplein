import { writeFile, mkdir } from 'node:fs/promises';
import { FactoryApiClient } from '../cloudflare/client.mjs';
import { cloudflareCatalog } from '../cloudflare/catalog.mjs';

const client = new FactoryApiClient();
const catalog = await cloudflareCatalog();
const shares = catalog.instruments.filter(x => x.mic === 'XAMS');
const dayMs = 86400000;
const events=[]; const failures=[];
const getBars = h => Array.isArray(h?.bars) ? h.bars : Array.isArray(h?.history) ? h.history : Array.isArray(h?.data) ? h.data : [];
const val = b => Number(b.close ?? b.c ?? b.adjustedClose ?? b.adjClose);
const date = b => b.date ?? b.d ?? b.timestamp;
for (const s of shares) {
  try {
    const h=await client.history(s.isin); const bars=getBars(h).filter(b=>date(b)&&Number.isFinite(val(b))&&val(b)>0).sort((a,b)=>String(date(a)).localeCompare(String(date(b))));
    if(!bars.length) throw new Error(`geen bars; keys=${Object.keys(h||{}).join(',')}`);
    let base=bars[0]; let basePrice=val(base); let seq=0;
    for(let i=1;i<bars.length;i++){
      const p=val(bars[i]);
      if(p>=basePrice*1.30){
        seq++; const days=Math.round((new Date(date(bars[i]))-new Date(date(base)))/dayMs);
        events.push({isin:s.isin,ticker:s.ticker,company:s.company,sequence:seq,startDate:date(base),startPrice:basePrice,hitDate:date(bars[i]),hitPrice:p,daysTo30:days,within90:days<=90,gain:p/basePrice-1});
        base=bars[i]; basePrice=p;
      }
    }
  } catch(e){ failures.push({isin:s.isin,ticker:s.ticker,error:e.message}); }
}
const fast=events.filter(e=>e.within90);
const bins=[['1-5',1,5],['6-10',6,10],['11-20',11,20],['21-30',21,30],['31-60',31,60],['61-90',61,90]];
const distribution=Object.fromEntries(bins.map(([n,a,b])=>[n,fast.filter(e=>e.daysTo30>=a&&e.daysTo30<=b).length]));
const byStock=new Map(); for(const e of fast) byStock.set(e.ticker,(byStock.get(e.ticker)||0)+1);
const topStocks=[...byStock].sort((a,b)=>b[1]-a[1]).slice(0,20).map(([ticker,count])=>({ticker,count}));
const sortedDays=fast.map(e=>e.daysTo30).sort((a,b)=>a-b); const median=sortedDays.length?sortedDays[Math.floor(sortedDays.length/2)]:null;
const summary={definition:'chain reset: first close >= 1.30 x current base becomes next base',stocks:shares.length,failedStocks:failures.length,totalChainSteps:events.length,within90:fast.length,within90Pct:events.length?fast.length/events.length:null,distribution,medianDaysWithin90:median,topStocks,examples:fast.slice().sort((a,b)=>a.daysTo30-b.daysTo30).slice(0,25),failures};
await mkdir('research/output/plus30-chain',{recursive:true});
await writeFile('research/output/plus30-chain/events.json',JSON.stringify(events,null,2));
await writeFile('research/output/plus30-chain/summary.json',JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
if(failures.length) process.exitCode=2;
