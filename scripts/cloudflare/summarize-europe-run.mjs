import fs from 'node:fs/promises';
const dir='research/output';
const files=await fs.readdir(dir);
const updates=[],audits=[];
for(const name of files){
 if(!/^daily-open-close-(update|audit)-\d+\.json$/.test(name))continue;
 const report=JSON.parse(await fs.readFile(`${dir}/${name}`,'utf8'));
 (name.includes('-update-')?updates:audits).push(report);
}
const totals={catalog:0,currentOpenClose:0,missingOpenClose:0,skippedDataUnavailable:0,failedImports:0,deferredMissing:0};
const markets=audits.flatMap(x=>x.markets);
for(const m of markets){totals.catalog+=m.catalog;totals.currentOpenClose+=m.openCloseOk;totals.missingOpenClose+=m.missingOpenClose;totals.skippedDataUnavailable+=m.skippedDataUnavailable;}
for(const m of updates.flatMap(x=>x.markets)){totals.failedImports+=m.failed.length;totals.deferredMissing+=m.deferredMissing;}
const shardsComplete=updates.length===8&&audits.length===8&&new Set(updates.map(x=>x.shardIndex)).size===8&&new Set(audits.map(x=>x.shardIndex)).size===8;
const dailyVerified=shardsComplete&&!totals.missingOpenClose&&!totals.failedImports&&!totals.deferredMissing;
const report={generatedAt:new Date().toISOString(),status:dailyVerified?'DAILY_OHLC_VERIFIED':'INCOMPLETE',historyCompleteness:'NOT_PROVEN_BY_DAILY_AUDIT',shardsComplete,totals,markets,importFailures:updates.flatMap(x=>x.markets.flatMap(m=>m.failed.map(f=>({mic:m.mic,...f}))))};
await fs.writeFile(`${dir}/europe-run-summary.json`,JSON.stringify(report,null,2));
const summary=`Europe run: ${report.status}\n\n${JSON.stringify(totals,null,2)}\n\nFull historical completeness is not established by the daily OHLC check.\n`;
console.log(summary);
if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,summary);
if(!dailyVerified)process.exitCode=2;
