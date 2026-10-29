import fs from 'node:fs/promises';
import {simulatePortfolio} from './amsterdam-portfolio-simulator.mjs';
const catalog=JSON.parse(await fs.readFile('data/euronext-amsterdam.json','utf8'));
const stocks=(catalog.shares||catalog.instruments||[]).filter(x=>x.displayPolicy!=='cross-market-reference-only');
const bars=[];
const excluded=new Set();
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
const available=new Set(bars.map(x=>x.date+'|'+x.instrument));
const groups=Map.groupBy(rows,x=>x.predictionDate),decisions=[];
for(const [cutoff,group] of groups){
  const date=sessions.find(d=>d>cutoff);
  if(!date)continue;
  const picks=group.filter(x=>x.sourcePriceDate<=cutoff&&x.informationCutoff<=cutoff&&available.has(date+'|'+x.instrument)&&Number.isFinite(x.availableSignals?.momentum12m))
    .sort((a,b)=>b.availableSignals.momentum12m-a.availableSignals.momentum12m).slice(0,5).map(x=>x.instrument);
  if(picks.length===5)decisions.push({date,picks});
}
decisions.sort((a,b)=>a.date.localeCompare(b.date));
if(!decisions.length)throw Error('No valid decisions');
const result=simulatePortfolio({bars:bars.filter(x=>x.date>=decisions[0].date),decisions});
const benchmarkDecisions=decisions.map(d=>({date:d.date,picks:[...new Set(bars.filter(b=>b.date===d.date).map(b=>b.instrument))].sort().slice(0,5)})).filter(d=>d.picks.length===5);
const benchmark=benchmarkDecisions.length?simulatePortfolio({bars:bars.filter(x=>x.date>=decisions[0].date),decisions:benchmarkDecisions}):null;
const quality=JSON.parse(await fs.readFile('research/output/amsterdam-history-quality-audit.json','utf8'));
for(const issue of quality.issues||[])if(issue.issue==='PRICE_JUMP_REQUIRES_CORPORATE_ACTION_REVIEW')excluded.add(issue.isin);
const cleanBars=bars.filter(b=>!excluded.has(b.instrument));
const cleanDecisions=decisions.map(d=>({...d,picks:d.picks.filter(id=>!excluded.has(id))})).filter(d=>d.picks.length===5);
const cleanResult=cleanDecisions.length?simulatePortfolio({bars:cleanBars.filter(x=>x.date>=cleanDecisions[0].date),decisions:cleanDecisions}):null;
const report={status:'RESEARCH_ONLY_NOT_INDEPENDENT_VALIDATION',historyQualityStatus:quality.status,historyQualitySummary:quality.summary,strategy:'FROZEN_12M_MOMENTUM_TOP5',execution:'FIRST_SESSION_AFTER_MONTH_END',dataInstruments:new Set(bars.map(x=>x.instrument)).size,decisions:decisions.length,initialCash:result.initialCash,finalNav:result.finalNav,totalReturn:result.totalReturn,totalFees:result.totalFees,maxDrawdown:result.maxDrawdown,trades:result.ledger.length,referencePortfolio:{method:'ALPHABETICAL_FIRST_FIVE_AVAILABLE_ISINS_REBALANCED_MONTHLY',status:'MECHANICAL_CONTROL_NOT_MARKET_INDEX',decisions:benchmarkDecisions.length,finalNav:benchmark?.finalNav??null,totalReturn:benchmark?.totalReturn??null,maxDrawdown:benchmark?.maxDrawdown??null,fees:benchmark?.totalFees??null},qualitySensitivity:{excludedInstruments:excluded.size,eligibleDecisions:cleanDecisions.length,finalNav:cleanResult?.finalNav??null,totalReturn:cleanResult?.totalReturn??null,maxDrawdown:cleanResult?.maxDrawdown??null,interpretation:'Conservative sensitivity: exclude any instrument with flagged >50% single-session move; not a corrected total-return backtest'},warning:'Raw cumulative return is not independently validated, adjusted for corporate actions, or suitable for publication.'};
await fs.writeFile('research/output/amsterdam-portfolio-diagnostic.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
