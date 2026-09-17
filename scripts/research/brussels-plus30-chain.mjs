import { writeFile, mkdir } from 'node:fs/promises';
import { FactoryApiClient } from '../cloudflare/client.mjs';
import { cloudflareCatalog } from '../cloudflare/catalog.mjs';

const client = new FactoryApiClient();
const catalog = await cloudflareCatalog();
const shares = catalog.instruments.filter(x => x.mic === 'XBRU');
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
        events.push({isin:s.isin,ticker:s.ticker,company:s.company,sequence:seq,startDate:date(base),startPrice:basePrice,hitDate:date(bars[i]),hitPrice:p,daysTo30:days,gain:p/basePrice-1});
        base=bars[i]; basePrice=p;
      }
    }
  } catch(e){ failures.push({isin:s.isin,ticker:s.ticker,error:e.message}); }
}
const horizons=[['3m',90],['6m',180],['9m',270],['12m',365],['24m',730]];
const results={};
for(const [label,days] of horizons){const ev=events.filter(e=>e.daysTo30<=days);results[label]={events:ev.length,uniqueStocks:new Set(ev.map(e=>e.isin)).size,sharePct:shares.length?new Set(ev.map(e=>e.isin)).size/shares.length:null,eventsPct:events.length?ev.length/events.length:null,medianDays:ev.length?[...ev].map(e=>e.daysTo30).sort((a,b)=>a-b)[Math.floor(ev.length/2)]:null};}
const summary={market:'XBRU',definition:'chain reset: first close >= 1.30 x current base becomes next base',stocks:shares.length,failedStocks:failures.length,totalChainSteps:events.length,horizons:results,failures};
await mkdir('research/output/brussels-plus30-chain',{recursive:true});
await writeFile('research/output/brussels-plus30-chain/events.json',JSON.stringify(events,null,2));
await writeFile('research/output/brussels-plus30-chain/summary.json',JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
if(failures.length) process.exitCode=2;
