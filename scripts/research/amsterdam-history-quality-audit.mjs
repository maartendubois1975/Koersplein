import fs from 'node:fs/promises';
const catalog=JSON.parse(await fs.readFile('data/euronext-amsterdam.json','utf8'));
const stocks=(catalog.shares||catalog.instruments||[]).filter(x=>x.displayPolicy!=='cross-market-reference-only');
const issues=[],summary={catalog:stocks.length,files:0,missing:0,largeDailyMoves:0,duplicateDates:0,invalidPrices:0,gapsOver30Days:0};
for(const stock of stocks){
 let raw;
 try{raw=JSON.parse(await fs.readFile('data/history/'+stock.isin+'.json','utf8')))}catch{summary.missing++;issues.push({isin:stock.isin,issue:'MISSING_HISTORY'});continue}
 const data=(Array.isArray(raw)?raw:raw.bars||raw.records||raw.history||[]).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
 summary.files++;
 let prev=null;
 for(const b of data){
  const p=Number(b.close);
  if(!b.date||!Number.isFinite(p)||p<=0){summary.invalidPrices++;continue}
  if(prev){
   if(b.date===prev.date){summary.duplicateDates++;issues.push({isin:stock.isin,date:b.date,issue:'DUPLICATE_DATE'})}
   const days=(Date.parse(b.date)-Date.parse(prev.date))/86400000;
   if(days>30){summary.gapsOver30Days++;issues.push({isin:stock.isin,date:b.date,issue:'GAP_OVER_30_DAYS',days})}
   const ratio=p/prev.price;
   if(ratio>1.5||ratio<0.5){summary.largeDailyMoves++;issues.push({isin:stock.isin,date:b.date,issue:'PRICE_JUMP_REQUIRES_CORPORATE_ACTION_REVIEW',ratio})}
  }
  prev={date:b.date,price:p};
 }
}
const report={status:issues.length?'RESEARCH_DATA_REQUIRES_REVIEW':'NO_FLAGGED_ISSUES',summary,issues,issueCount:issues.length,truncated:false,note:'Flags are not automatically errors: splits, dividends and suspended stocks require source verification. No portfolio promotion.'};
await fs.mkdir('research/output',{recursive:true});
await fs.writeFile('research/output/amsterdam-history-quality-audit.json',JSON.stringify(report,null,2));
console.log('AMSTERDAM_HISTORY_QUALITY_AUDIT',JSON.stringify({status:report.status,summary,issues:issues.length}));
