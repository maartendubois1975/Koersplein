import fs from 'node:fs/promises';
const base='research/output/';
const read=async name=>JSON.parse(await fs.readFile(base+name,'utf8'));
const [structural,quality,provenance]=await Promise.all([read('amsterdam-structural-integrity-audit.json'),read('amsterdam-history-quality-audit.json'),read('amsterdam-data-provenance-audit.json')]);
const catalog=JSON.parse(await fs.readFile('data/euronext-amsterdam.json','utf8'));
const shares=(catalog.shares||[]).filter(x=>x.displayPolicy!=='cross-market-reference-only');
const byIsin=new Map(shares.map(x=>[x.isin,x]));
const structuralByIsin=new Map();
for(const x of structural.issues||[]){const a=structuralByIsin.get(x.isin)||[];a.push(x);structuralByIsin.set(x.isin,a)}
const qualityByIsin=new Map();
for(const x of quality.issues||[]){const a=qualityByIsin.get(x.isin)||[];a.push(x);qualityByIsin.set(x.isin,a)}
const provenanceByIsin=new Map((provenance.rows||[]).map(x=>[x.isin,x]));
const issuerByIsin=new Map((quality.issuerCases||[]).map(x=>[x.isin,x]));
const rows=shares.map(s=>{
 const structuralIssues=structuralByIsin.get(s.isin)||[],historyIssues=qualityByIsin.get(s.isin)||[],p=provenanceByIsin.get(s.isin)||{};
 const jumps=historyIssues.filter(x=>x.issue==='PRICE_JUMP_REQUIRES_CORPORATE_ACTION_REVIEW');
 const gaps=historyIssues.filter(x=>x.issue==='GAP_OVER_30_DAYS');
 const hardErrors=structuralIssues.filter(x=>!['MISSING_HIGH_LOW'].includes(x.issue));
 const missingHighLow=structuralIssues.filter(x=>x.issue==='MISSING_HIGH_LOW');
 const hasHistory=Number(p.bars)>0&&!p.error;
 const rawChartAllowed=hasHistory&&!hardErrors.length;
 const verifiedAdjusted=p.adjustmentProvenanceVerified===true&&p.backfillComplete===true&&!jumps.length&&!gaps.length&&!missingHighLow.length&&!hardErrors.length;
 return {isin:s.isin,name:s.name,records:p.bars||0,firstDate:p.firstDate||null,lastDate:p.lastDate||null,rawChartAllowed,rawChartLabel:'UNADJUSTED_RAW_PRICE_HISTORY',returnsAndPredictionAllowed:verifiedAdjusted,reasonCodes:[...(!hasHistory?['MISSING_HISTORY']:[]),...(hardErrors.length?['STRUCTURAL_ERRORS']:[]),...(missingHighLow.length?['INCOMPLETE_OHLC']:[]),...(jumps.length?['UNVERIFIED_PRICE_JUMPS']:[]),...(gaps.length?['LONG_HISTORY_GAPS']:[]),...(!p.adjustmentProvenanceVerified?['UNVERIFIED_ADJUSTMENT']:[]),...(!p.backfillComplete?['UNVERIFIED_COMPLETENESS']:[])],counts:{structuralErrors:hardErrors.length,missingHighLow:missingHighLow.length,priceJumps:jumps.length,longGaps:gaps.length},evidenceLeads:issuerByIsin.get(s.isin)?.evidenceLeads||[]};
});
const summary={instruments:rows.length,rawChartsAllowed:rows.filter(x=>x.rawChartAllowed).length,returnsAndPredictionAllowed:rows.filter(x=>x.returnsAndPredictionAllowed).length,issuersWithJumps:rows.filter(x=>x.counts.priceJumps).length,priceJumps:rows.reduce((n,x)=>n+x.counts.priceJumps,0),longGaps:rows.reduce((n,x)=>n+x.counts.longGaps,0),missingHighLow:rows.reduce((n,x)=>n+x.counts.missingHighLow,0)};
const report={schemaVersion:1,status:summary.returnsAndPredictionAllowed===summary.instruments?'READY_FOR_SEPARATE_POINT_IN_TIME_BACKTEST_REVIEW':'BACKTEST_BLOCKED_SOURCE_VERIFICATION_REQUIRED',summary,policy:{rawCharts:'Unadjusted price history only, label clearly and do not infer total return',predictions:'Require independently verified corporate actions, completeness, historical constituents and delistings',missingData:'Never invent OHLC or adjust corporate actions automatically'},rows};
await fs.mkdir(base,{recursive:true});
await fs.writeFile(base+'amsterdam-consolidated-quality-gate.json',JSON.stringify(report,null,2)+'\n');
console.log('AMSTERDAM_CONSOLIDATED_QUALITY_GATE',JSON.stringify({status:report.status,summary}));
