import fs from 'node:fs/promises';
const catalog=JSON.parse(await fs.readFile('data/euronext-amsterdam.json','utf8'));
const stocks=(catalog.shares||catalog.instruments||[]).filter(x=>x.displayPolicy!=='cross-market-reference-only');
const issues=[],summary={catalog:stocks.length,files:0,missing:0,largeDailyMoves:0,duplicateDates:0,invalidPrices:0,gapsOver30Days:0,largeMovesWithin7CalendarDays:0,largeMovesAfter7CalendarDays:0};
for(const stock of stocks){
 let raw;
 try{raw=JSON.parse(await fs.readFile('data/history/'+stock.isin+'.json','utf8'))}catch{summary.missing++;issues.push({isin:stock.isin,issue:'MISSING_HISTORY'});continue}
 const data=(Array.isArray(raw)?raw:raw.bars||raw.records||raw.history||[]).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
 summary.files++;
 let prev=null;
 for(const b of data){
  const p=Number(b.close);
  if(!b.date||!Number.isFinite(p)||p<=0){summary.invalidPrices++;continue}
  if(prev){
   if(b.date===prev.date){summary.duplicateDates++;issues.push({isin:stock.isin,date:b.date,name:stock.name,issue:'DUPLICATE_DATE'})}
   const days=(Date.parse(b.date)-Date.parse(prev.date))/86400000;
   if(days>30){summary.gapsOver30Days++;issues.push({isin:stock.isin,date:b.date,name:stock.name,previousDate:prev.date,issue:'GAP_OVER_30_DAYS',days})}
   const ratio=p/prev.price;
   if(ratio>1.5||ratio<0.5){summary.largeDailyMoves++;if(days<=7)summary.largeMovesWithin7CalendarDays++;else summary.largeMovesAfter7CalendarDays++;issues.push({isin:stock.isin,date:b.date,name:stock.name,previousDate:prev.date,calendarDaysBetweenObservations:days,previousClose:prev.price,currentClose:p,issue:'PRICE_JUMP_REQUIRES_CORPORATE_ACTION_REVIEW',ratio})}
  }
  prev={date:b.date,price:p};
 }
}
const reviewQueue=issues.filter(x=>x.issue==='PRICE_JUMP_REQUIRES_CORPORATE_ACTION_REVIEW').sort((a,b)=>Math.abs(Math.log(b.ratio))-Math.abs(Math.log(a.ratio))).map((x,i)=>({...x,priority:i+1,verificationStatus:'UNVERIFIED',possibleCauses:['split','reverse_split','rights_issue','corporate_action','genuine_move','data_error'],requiredEvidence:'Issuer announcement and independent dated price source'}));
const evidenceRegistry={
 'NL0000345627':[{date:'2015-12-22',event:'extraordinary_dividend',source:'https://www.afm.nl/nl-nl/sector/registers/meldingenregisters/openbaarmaking-voorwetenschap/details?id=201512150000000006',scope:'Issuer sale disclosure, not an independently verified ex-dividend amount or adjusted price',status:'CONTEXT_ONLY'},{date:'2015-12-22',event:'special_dividend',source:'https://www.analist.nl/aandeel/324-ease2pay',scope:'Secondary dividend research lead, independently verify amount',status:'SECONDARY_LEAD'}],
 'NL0000378669':[{date:'2008-09-12',event:'rights_offering',source:'https://live.euronext.com/sites/default/files/PORCELEYNE_FLES_Final_Prospectus_EN.pdf',scope:'Issuer prospectus: 8 for 5 rights offering at EUR 13.83, not automatic proof of an adjustment factor',status:'PRIMARY_EVENT_CONFIRMED'}]
};
const issuerCases=stocks.map(s=>({isin:s.isin,name:s.name,priceJumpCases:reviewQueue.filter(x=>x.isin===s.isin).map(x=>({date:x.date,previousDate:x.previousDate,ratio:x.ratio,calendarDaysBetweenObservations:x.calendarDaysBetweenObservations,verificationStatus:'UNVERIFIED'})),missingHighLow:['NL0000345627','NL0000378669'].includes(s.isin)?(s.isin==='NL0000345627'?['2000-05-04']:['2000-07-24','2000-07-25']):[],evidenceLeads:evidenceRegistry[s.isin]||[],issuerEvidenceStatus:'REQUIRES_DATE_MATCHED_PRICE_AND_CORPORATE_ACTION_EVIDENCE'})).filter(x=>x.priceJumpCases.length||x.missingHighLow.length);
await fs.writeFile('research/output/amsterdam-issuer-investigation-cases.json',JSON.stringify({status:'OPEN_REVIEW_NOT_VALIDATED',cases:issuerCases,policy:'Never repair price data or declare jumps verified solely from issuer-level context or a prospectus.'},null,2));
console.log('AMSTERDAM_ISSUER_CASES',JSON.stringify({issuers:issuerCases.length,jumps:reviewQueue.length,knownIssuerContext:issuerCases.filter(x=>x.evidenceLeads.length).length}));
const report={issuerCases,reviewQueue,status:issues.length?'RESEARCH_DATA_REQUIRES_REVIEW':'NO_FLAGGED_ISSUES',summary,issues,issueCount:issues.length,truncated:false,note:'Large moves compare consecutive available observations, not necessarily consecutive trading sessions. Calendar gaps are recorded per issue. Flags are not automatically errors: splits, dividends and suspended stocks require source verification. No portfolio promotion.'};
await fs.mkdir('research/output',{recursive:true});
await fs.writeFile('research/output/amsterdam-history-quality-audit.json',JSON.stringify(report,null,2));
console.log('AMSTERDAM_HISTORY_QUALITY_AUDIT',JSON.stringify({status:report.status,summary,issues:issues.length}));
