import fs from 'node:fs/promises';
import {simulatePortfolio} from './amsterdam-portfolio-simulator.mjs';
const catalog=JSON.parse(await fs.readFile('data/euronext-amsterdam.json','utf8'));
const stocks=(catalog.shares||catalog.instruments||[]).filter(x=>x.displayPolicy!=='cross-market-reference-only');
const bars=[];
for(const s of stocks){
  try{
    const raw=JSON.parse(await fs.readFile('data/history/'+s.isin+'.json','utf8'));
    for(const b of (Array.isArray(raw)?raw:raw.bars||raw.records||raw.history||[])){
      if(b.date&&Number(b.close)>0)bars.push({date:b.date,instrument:s.isin,close:Number(b.close)});
    }
  }catch{}
}
if(!bars.length)throw Error('No price history');
const rows=(await fs.readFile('research/output/amsterdam-machine1-results.jsonl','utf8')).trim().split('\n').map(JSON.parse);
const sessions=[...new Set(bars.map(x=>x.date))].sort();
const groups=Map.groupBy(rows,x=>x.predictionDate),decisions=[];
for(const [cutoff,group] of groups){
  const date=sessions.find(d=>d>cutoff);
  if(!date)continue;
  const picks=group.filter(x=>x.sourcePriceDate<=cutoff&&Number.isFinite(x.availableSignals?.momentum12m))
    .sort((a,b)=>b.availableSignals.momentum12m-a.availableSignals.momentum12m).slice(0,5).map(x=>x.instrument);
  if(picks.length===5)decisions.push({date,picks});
}
decisions.sort((a,b)=>a.date.localeCompare(b.date));
if(!decisions.length)throw Error('No valid decisions');
const result=simulatePortfolio({bars:bars.filter(x=>x.date>=decisions[0].date),decisions});
const report={status:'RESEARCH_ONLY',decisions:decisions.length,initialCash:result.initialCash,finalNav:result.finalNav,totalReturn:result.totalReturn,totalFees:result.totalFees,maxDrawdown:result.maxDrawdown,trades:result.ledger.length};
await fs.writeFile('research/output/amsterdam-portfolio-diagnostic.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
