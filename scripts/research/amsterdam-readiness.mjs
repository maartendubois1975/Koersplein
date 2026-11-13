import fs from 'node:fs/promises';
const catalog=JSON.parse(await fs.readFile('data/euronext-amsterdam.json','utf8'));
const active=(catalog.shares||[]).filter(x=>x.displayPolicy!=='cross-market-reference-only');
const horizons=[3,6,12,24], targets=[10,20,30];
const rows=[];
for(const share of active){
 const file='data/history/'+share.isin+'.json';
 try{
  const doc=JSON.parse(await fs.readFile(file,'utf8'));
  const bars=(doc.bars||[]).filter(x=>x.date&&Number.isFinite(Number(x.close))&&Number(x.close)>0).sort((a,b)=>a.date.localeCompare(b.date));
  const first=bars[0]?.date||null,last=bars.at(-1)?.date||null;
  const years=first&&last?(Date.parse(last)-Date.parse(first))/86400000/365.25:0;
  rows.push({symbol:share.symbol,isin:share.isin,records:bars.length,first,last,years:+years.toFixed(2),eligibleForBlindExam:years>=5&&bars.length>=750,eligibleHorizons:horizons.filter(h=>years>=5+h/12)});
 }catch(e){rows.push({symbol:share.symbol,isin:share.isin,records:0,error:String(e.message),eligibleForBlindExam:false,eligibleHorizons:[]})}
}
const eligible=rows.filter(x=>x.eligibleForBlindExam);
const report={market:'XAMS',asOf:new Date().toISOString(),scope:'Historical data readiness only; not predictive validation',activeShares:active.length,examEligible:eligible.length,insufficient:rows.filter(x=>!x.eligibleForBlindExam),horizonsMonths:horizons,targetsPct:targets,examRule:'Chronological point-in-time splits; purged training windows; untouched final holdout; compare against benchmarks; no predictions published before independent validation',shares:rows};
console.log('AMSTERDAM_RESEARCH_READINESS '+JSON.stringify(report));
if(active.length!==80)process.exitCode=1;
