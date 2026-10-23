import fs from 'node:fs/promises';
import {diagnoseEuropeReports} from './europe-failure-diagnosis.mjs';
import {buildEuropeRecoveryQueue} from './europe-recovery-queue.mjs';
import {evaluateEuropeShardCoverage} from './europe-shard-coverage.mjs';
const dir='research/output';
const files=await fs.readdir(dir);
const latestUpdates=new Map(),latestAudits=new Map();
for(const name of files){
 if(!/^daily-open-close-(update|audit)-\d+(?:-attempt-\d+)?\.json$/.test(name))continue;
 const report=JSON.parse(await fs.readFile(`${dir}/${name}`,'utf8'));
 const latest=name.includes('-update-')?latestUpdates:latestAudits;
 const old=latest.get(report.shardIndex);
 if(!old||report.generatedAt>old.generatedAt)latest.set(report.shardIndex,report);
}
const updates=[...latestUpdates.values()],audits=[...latestAudits.values()];
const totals={catalog:0,currentOpenClose:0,verifiedNoTrades:0,missingOpenClose:0,skippedDataUnavailable:0,failedImports:0,deferredMissing:0,historicalBackfillFailures:0,recentInvalidOhlcDays:0,recentInvalidOhlcInstruments:0};
const markets=audits.flatMap(x=>x.markets);
const missingByReason={};
const invalidOhlcByDefect={};
const knownDataUnavailableByMarket={};
for(const m of markets){
 for(const [reason,count] of Object.entries(m.missingReasons||{}))missingByReason[reason]=(missingByReason[reason]||0)+count;
 for(const [defect,count] of Object.entries(m.invalidOhlcByDefect||{}))invalidOhlcByDefect[defect]=(invalidOhlcByDefect[defect]||0)+count;
 if(m.knownDataUnavailableAmongMissing)knownDataUnavailableByMarket[m.mic]=m.knownDataUnavailableAmongMissing;
 totals.recentInvalidOhlcDays+=m.recentInvalidOhlcDays||0;
 totals.recentInvalidOhlcInstruments+=m.recentInvalidOhlcInstruments||0;
 totals.catalog+=m.catalog;totals.currentOpenClose+=m.openCloseOk;totals.verifiedNoTrades+=m.verifiedNoTrades||0;totals.missingOpenClose+=m.missingOpenClose;totals.skippedDataUnavailable+=m.skippedDataUnavailable;}
for(const m of updates.flatMap(x=>x.markets)){totals.failedImports+=m.failed.length;totals.historicalBackfillFailures+=(m.historicalBackfillFailures||[]).length;totals.deferredMissing+=m.deferredMissing;}
const plan=JSON.parse(await fs.readFile('data/world-fill-plan.json','utf8'));
const marketCoverage=evaluateEuropeShardCoverage(plan,updates,audits,8);
const shardsComplete=marketCoverage.complete;
const dailyVerified=shardsComplete&&!totals.missingOpenClose&&!totals.failedImports&&!totals.deferredMissing&&!totals.skippedDataUnavailable;
const sourceFailureByMarket={};
for(const m of updates.flatMap(x=>x.markets)){
 const categories={};for(const f of m.failed||[])categories[f.category||'UNCLASSIFIED']=(categories[f.category||'UNCLASSIFIED']||0)+1;
 sourceFailureByMarket[m.mic]={failed:(m.failed||[]).length,categories};
}
const recoveryPriority=markets.map(m=>({mic:m.mic,catalog:m.catalog,missingOpenClose:m.missingOpenClose,knownDataUnavailableAmongMissing:m.knownDataUnavailableAmongMissing||0,importFailures:sourceFailureByMarket[m.mic]?.failed||0})).sort((a,b)=>b.missingOpenClose-a.missingOpenClose);
const historicalOhlcDebt={readOnly:true,datesInRecoveryQueue:recoveryQueue.totals.recentOhlcDebtDates,byMarket:markets.map(m=>({mic:m.mic,defectiveDates:m.recentInvalidOhlcDays||0,affectedInstruments:m.recentInvalidOhlcInstruments||0})).filter(m=>m.defectiveDates).sort((a,b)=>b.defectiveDates-a.defectiveDates)};
const diagnosis=diagnoseEuropeReports(updates,audits);
const recoveryQueue=buildEuropeRecoveryQueue(updates,audits);
await fs.writeFile(`${dir}/europe-recovery-queue.json`,JSON.stringify(recoveryQueue,null,2));
await fs.writeFile(`${dir}/europe-failure-diagnosis.json`,JSON.stringify(diagnosis,null,2));
const failureDiagnosis=diagnosis.markets.slice(0,12).map(({mic,failed,missingOpenClose,numericSymbolFailures,categories,primaryCause,nextAction})=>({mic,failed,missingOpenClose,numericSymbolFailures,categories,primaryCause,nextAction}));
const report={generatedAt:new Date().toISOString(),status:dailyVerified?'DAILY_STATUS_VERIFIED':'INCOMPLETE',historyCompleteness:'NOT_PROVEN_BY_DAILY_AUDIT',shardsComplete,marketCoverage,totals,recoveryQueueOverview:recoveryQueue.markets.slice(0,8).map(({mic,missing,numericSwissValor,knownDataUnavailable,workstreams})=>({mic,missing,numericSwissValor,knownDataUnavailable,workstreams})),recoveryPriority,historicalOhlcDebt,failureDiagnosis,missingByReason,invalidOhlcByDefect,knownDataUnavailableByMarket,sourceFailureByMarket,markets,historicalBackfillFailures:updates.flatMap(x=>x.markets.flatMap(m=>(m.historicalBackfillFailures||[]).map(f=>({mic:m.mic,...f})))),importFailures:updates.flatMap(x=>x.markets.flatMap(m=>m.failed.map(f=>({mic:m.mic,...f}))))};
await fs.writeFile(`${dir}/europe-run-summary.json`,JSON.stringify(report,null,2));
const summary=`Europe run: ${report.status}\n\n${JSON.stringify(totals,null,2)}\n\nFull historical completeness is not established by the daily OHLC check.\n`;
console.log(summary);
if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,summary);
if(!dailyVerified)process.exitCode=2;
