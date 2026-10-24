import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

// Execute the real summary entry point against synthetic, local-only reports.
// This catches runtime initialization errors that node --check cannot detect.
const executable=fileURLToPath(new URL('./summarize-europe-run.mjs',import.meta.url));
const fixture=await fs.mkdtemp(path.join(os.tmpdir(),'koersplein-europe-summary-'));
try {
 await fs.mkdir(path.join(fixture,'data'));
 await fs.mkdir(path.join(fixture,'research/output'),{recursive:true});
 await fs.writeFile(path.join(fixture,'data/world-fill-plan.json'),JSON.stringify({markets:[{mic:'XPAR',state:'COMPLETE'}]}));
 const reportDir=path.join(fixture,'research/output');
 for(let shard=0;shard<8;shard++){
  const update={generatedAt:'2026-10-23T10:00:00Z',shardIndex:shard,shardCount:8,freshnessCutoff:'2026-10-22',markets:shard===0?[{mic:'XPAR',failed:[],deferredMissing:0,historicalBackfillFailures:[]}]:[]};
  const audit={generatedAt:'2026-10-23T10:00:00Z',shardIndex:shard,shardCount:8,freshnessCutoff:'2026-10-22',markets:shard===0?[{mic:'XPAR',catalog:1,openCloseOk:1,verifiedNoTrades:0,missingOpenClose:0,skippedDataUnavailable:0,recentInvalidOhlcDays:1,recentInvalidOhlcInstruments:1,recentOhlcDebtCandidates:[{isin:'FR0000061418',symbol:'SACI',date:'2026-10-22',defects:['HIGH_BELOW_CLOSE']}],storedOhlcConflictDates:1,storedOhlcConflictCandidates:[{isin:'FR0000061418',symbol:'SACI',date:'2026-10-22',category:'MIXED_COMPLETE_INVALID_STORED_OHLC',rows:2,distinctOhlc:2}],missing:[],missingReasons:{},invalidOhlcByDefect:{}}]:[]};
  await fs.writeFile(path.join(reportDir,`daily-open-close-update-${shard}.json`),JSON.stringify(update));
  await fs.writeFile(path.join(reportDir,`daily-open-close-audit-${shard}.json`),JSON.stringify(audit));
 }
 const run=()=>spawnSync(process.execPath,[executable],{cwd:fixture,encoding:'utf8',timeout:15000,env:{...process.env,GITHUB_STEP_SUMMARY:''}});
 let result=run();
 assert.equal(result.status,0,`Complete summary failed: ${result.stderr}`);
 let summary=JSON.parse(await fs.readFile(path.join(reportDir,'europe-run-summary.json'),'utf8'));
 assert.equal(summary.marketCoverage.complete,true);
 assert.equal(summary.totals.catalog,1);
 assert.equal(summary.historicalOhlcDebt.datesInRecoveryQueue,1);
 assert.equal(summary.storedOhlcDuplicateEvidence.complete,true);
 assert.equal(summary.storedOhlcDuplicateEvidence.dates,1);
 assert.equal(summary.storedOhlcDuplicateEvidence.byMarket[0].mic,'XPAR');
 const recovery=JSON.parse(await fs.readFile(path.join(reportDir,'europe-recovery-queue.json'),'utf8'));
 assert.equal(recovery.totals.storedOhlcConflictDates,1);
 assert.equal(recovery.totals.recentOhlcDebtDates,1,'Stored duplicate conflicts cannot inflate ordinary OHLC debt');
 assert.equal(summary.status,'DAILY_STATUS_VERIFIED');
 assert.equal(summary.freshnessCutoff,'2026-10-22');
 assert.equal(summary.sessionConsistency.complete,true);
 // A session rollover inside one 8-shard run must fail closed even when all
 // markets are accounted for and every OHLC candle is otherwise valid.
 const audit7Path=path.join(reportDir,'daily-open-close-audit-7.json');
 const audit7=JSON.parse(await fs.readFile(audit7Path,'utf8'));
 await fs.writeFile(audit7Path,JSON.stringify({...audit7,freshnessCutoff:'2026-10-23'}));
 result=run();
 assert.equal(result.status,2,'Mismatched update/audit session dates must fail closed');
 summary=JSON.parse(await fs.readFile(path.join(reportDir,'europe-run-summary.json'),'utf8'));
 assert.equal(summary.marketCoverage.complete,true);
 assert.equal(summary.sessionConsistency.complete,false);
 assert.equal(summary.freshnessCutoff,null);
 assert.equal(summary.auditEvidenceComplete,false);
 assert.equal(summary.totals.currentOpenClose,null,'Different cutoffs cannot prove European current coverage');
 assert.equal(summary.totals.recentInvalidOhlcDays,null,'Different cutoffs cannot prove historical OHLC debt');
 assert.equal(summary.historicalOhlcDebt.datesInRecoveryQueue,null);
 assert.equal(summary.storedOhlcDuplicateEvidence.complete,false);
 assert.ok(summary.sessionConsistency.anomalies.some(x=>x.issue==='SESSION_CUTOFF_MISMATCH'));
 await fs.writeFile(audit7Path,JSON.stringify(audit7));
 // Missing metadata must never be silently inferred from generatedAt.
 const update6Path=path.join(reportDir,'daily-open-close-update-6.json');
 const update6=JSON.parse(await fs.readFile(update6Path,'utf8'));
 const {freshnessCutoff:omitted,...noCutoff}=update6;
 await fs.writeFile(update6Path,JSON.stringify(noCutoff));
 result=run();
 assert.equal(result.status,2,'Missing session metadata must fail closed');
 summary=JSON.parse(await fs.readFile(path.join(reportDir,'europe-run-summary.json'),'utf8'));
 assert.ok(summary.sessionConsistency.anomalies.some(x=>x.issue==='MISSING_OR_INVALID_SESSION_CUTOFF'));
 await fs.writeFile(update6Path,JSON.stringify(update6));
 await fs.unlink(path.join(reportDir,'daily-open-close-audit-7.json'));
 result=run();
 assert.equal(result.status,2,`Missing audit shard must fail closed: ${result.stderr}`);
 summary=JSON.parse(await fs.readFile(path.join(reportDir,'europe-run-summary.json'),'utf8'));
 assert.equal(summary.marketCoverage.complete,false);
 assert.equal(summary.status,'INCOMPLETE');
 assert.equal(summary.auditEvidenceComplete,false);
 for(const key of ['catalog','currentOpenClose','verifiedNoTrades','missingOpenClose','recentInvalidOhlcDays','recentInvalidOhlcInstruments'])
  assert.equal(summary.totals[key],null,'Missing audit shard must not publish partial '+key);
 assert.equal(summary.historicalOhlcDebt.complete,false);
 assert.equal(summary.historicalOhlcDebt.datesInRecoveryQueue,null,'Missing audit shard cannot prove historical debt');
 assert.deepEqual(summary.historicalOhlcDebt.byMarket,[]);
 assert.equal(summary.storedOhlcDuplicateEvidence.complete,false,'Missing audit shard cannot prove stored duplicate count');
 assert.equal(summary.storedOhlcDuplicateEvidence.dates,null);
 assert.deepEqual(summary.recoveryPriority,[],'Do not rank partial market gaps as complete Europe');
 assert.deepEqual(summary.missingByReason,{});
 assert.ok(summary.marketCoverage.anomalies.some(x=>x.kind==='audit'&&x.shard===7&&x.issue==='REPORT_COUNT'));
 await fs.writeFile(path.join(reportDir,'daily-open-close-audit-7.json'),JSON.stringify({generatedAt:'2026-10-23T10:00:00Z',shardIndex:7,shardCount:8,freshnessCutoff:'2026-10-22',markets:[]}));
 await fs.unlink(path.join(reportDir,'daily-open-close-update-7.json'));
 result=run();
 assert.equal(result.status,2,`Missing update shard must fail closed: ${result.stderr}`);
 summary=JSON.parse(await fs.readFile(path.join(reportDir,'europe-run-summary.json'),'utf8'));
 assert.equal(summary.marketCoverage.complete,false);
 assert.equal(summary.auditEvidenceComplete,false,'Missing update shard also leaves session consistency unverified');
 assert.equal(summary.totals.catalog,null,'Cross-shard incomplete session must not publish European coverage');
 assert.equal(summary.storedOhlcDuplicateEvidence.complete,false);
 assert.equal(summary.historicalOhlcDebt.datesInRecoveryQueue,null);
 assert.equal(summary.totals.failedImports,null,'Missing update report must not imply zero failed imports');
 assert.equal(summary.totals.deferredMissing,null);
 assert.equal(summary.totals.historicalBackfillFailures,null);
 assert.ok(summary.marketCoverage.anomalies.some(x=>x.kind==='update'&&x.shard===7&&x.issue==='REPORT_COUNT'));
 console.log('Europe summary integration PASS: runtime, historical debt, session cutoff, 8/8 coverage and missing update/audit shard fail-closed');
} finally {
 await fs.rm(fixture,{recursive:true,force:true});
}
