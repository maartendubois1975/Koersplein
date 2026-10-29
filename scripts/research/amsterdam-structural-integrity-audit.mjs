import fs from 'node:fs/promises';
const catalog=JSON.parse(await fs.readFile('data/euronext-amsterdam.json','utf8'));
const shares=(catalog.shares||[]).filter(x=>x.displayPolicy!=='cross-market-reference-only');
const issues=[],byInstrument=[],counts={instruments:shares.length,files:0,invalidDates:0,invalidOHLC:0,invalidVolume:0,duplicateDates:0,unsortedDates:0,coverageMismatch:0,nonEUR:0,wrongVenue:0,missingBars:0};
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
for(const stock of shares){
 let h;try{h=JSON.parse(await fs.readFile('data/history/'+stock.isin+'.json','utf8'))}catch(e){issues.push({isin:stock.isin,issue:'MISSING_FILE',detail:e.message});continue}
 counts.files++;const bars=h.bars||[],seen=new Set();let previous='',local=0;
 if(!bars.length){counts.missingBars++;issues.push({isin:stock.isin,issue:'NO_BARS'})}
 if(h.instrument?.currency!=='EUR'){counts.nonEUR++;issues.push({isin:stock.isin,issue:'CURRENCY_NOT_EUR',value:h.instrument?.currency})}
 if(h.instrument?.mic!=='XAMS'){counts.wrongVenue++;issues.push({isin:stock.isin,issue:'VENUE_NOT_XAMS',value:h.instrument?.mic})}
 if(h.coverage?.records!==bars.length){counts.coverageMismatch++;issues.push({isin:stock.isin,issue:'COVERAGE_RECORDS_MISMATCH',claimed:h.coverage?.records,actual:bars.length})}
 for(const b of bars){
  if(!validDate(b.date)){counts.invalidDates++;issues.push({isin:stock.isin,issue:'INVALID_DATE',date:b.date});continue}
  if(seen.has(b.date)){counts.duplicateDates++;issues.push({isin:stock.isin,issue:'DUPLICATE_DATE',date:b.date})}seen.add(b.date);
  if(previous&&b.date<previous){counts.unsortedDates++;issues.push({isin:stock.isin,issue:'UNSORTED_DATE',date:b.date,previous})}previous=b.date;
  const o=Number(b.open),hi=Number(b.high),lo=Number(b.low),cl=Number(b.close);
  if(![o,hi,lo,cl].every(v=>Number.isFinite(v)&&v>0)||lo>Math.min(o,cl)||hi<Math.max(o,cl)||hi<lo){counts.invalidOHLC++;local++;issues.push({isin:stock.isin,issue:'INVALID_OHLC',date:b.date,open:b.open,high:b.high,low:b.low,close:b.close})}
  if(b.volume!=null&&(!Number.isFinite(Number(b.volume))||Number(b.volume)<0)){counts.invalidVolume++;issues.push({isin:stock.isin,issue:'INVALID_VOLUME',date:b.date,volume:b.volume})}
 }
 byInstrument.push({isin:stock.isin,name:stock.name,records:bars.length,first:bars[0]?.date,last:bars.at(-1)?.date,invalidOHLC:local});
}
const report={status:issues.length?'STRUCTURAL_DATA_ISSUES_REQUIRE_REVIEW':'STRUCTURE_PASSED_NOT_PROVEN_CORPORATE_ACTION_ADJUSTED',counts,issues,byInstrument,note:'Structural integrity does not establish total-return adjustments, historical listing membership or licensed redistribution.'};
await fs.mkdir('research/output',{recursive:true});
await fs.writeFile('research/output/amsterdam-structural-integrity-audit.json',JSON.stringify(report,null,2));
console.log('AMSTERDAM_STRUCTURAL_INTEGRITY_AUDIT',JSON.stringify({status:report.status,counts,issues:issues.length}));
