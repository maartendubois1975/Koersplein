import fs from 'node:fs/promises';
const mics=['XBRU','XAMS','XPAR','XMIL','XOSL','XDUB','XLIS','XLON','XETR','XSWX','XMAD','XSTO','XCSE','XHEL','XICE','XATH','XWAR','XWBO','XPRA','XBUD','XBSE','XBUL','XZAG','XLJU','XBRA','XLUX','XMAL','XCYS','XTAL','XRIS','XLIT'];
const root='research/output';const markets=[];let passed=0;
for(const mic of mics){
 try{
  const p=JSON.parse(await fs.readFile(root+'/'+mic+'/pipeline-summary.json','utf8'));
  const q=p.quality||{};
  const issues=[...(p.qualityIssues||[])];
  if(p.status!=='BASELINE_GENERATED_NOT_INDEPENDENTLY_VALIDATED')issues.push('MARKET_PIPELINE_FAILED');
  if(!(q.catalogInstruments>0&&q.usableInstruments===q.catalogInstruments))issues.push('HISTORY_NOT_COMPLETE');
  if(q.failed||q.insufficientHistory||q.skippedMissingIsin)issues.push('UNRESOLVED_SOURCE_OR_IDENTITY');
  const ok=issues.length===0;if(ok)passed++;
  markets.push({mic,status:ok?'HISTORICAL_BASELINE_READY':'INCOMPLETE',issues,quality:q});
 }catch(e){markets.push({mic,status:'MISSING',issues:[e.code||e.message]});}
}
const report={generatedAt:new Date().toISOString(),marketsExpected:mics.length,marketsBaselineReady:passed,all31Ready:passed===mics.length,elevenMachineCompetitionValidated:false,productionReady:false,markets};
await fs.mkdir(root+'/machine-arena',{recursive:true});
await fs.writeFile(root+'/machine-arena/europe-31-market-audit.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({marketsExpected:31,marketsBaselineReady:passed,all31Ready:report.all31Ready,productionReady:false}));
if(!report.all31Ready)process.exitCode=1;
