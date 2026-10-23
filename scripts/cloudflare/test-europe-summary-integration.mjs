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
  const update={generatedAt:'2026-10-23T10:00:00Z',shardIndex:shard,shardCount:8,markets:shard===0?[{mic:'XPAR',failed:[],deferredMissing:0,historicalBackfillFailures:[]}]:[]};
  const audit={generatedAt:'2026-10-23T10:00:00Z',shardIndex:shard,shardCount:8,markets:shard===0?[{mic:'XPAR',catalog:1,openCloseOk:1,verifiedNoTrades:0,missingOpenClose:0,skippedDataUnavailable:0,recentInvalidOhlcDays:1,recentInvalidOhlcInstruments:1,recentOhlcDebtCandidates:[{isin:'FR0000061418',symbol:'SACI',date:'2026-10-22',defects:['HIGH_BELOW_CLOSE']}],missing:[],missingReasons:{},invalidOhlcByDefect:{}}]:[]};
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
 assert.equal(summary.status,'DAILY_STATUS_VERIFIED');
 await fs.unlink(path.join(reportDir,'daily-open-close-audit-7.json'));
 result=run();
 assert.equal(result.status,2,`Missing audit shard must fail closed: ${result.stderr}`);
 summary=JSON.parse(await fs.readFile(path.join(reportDir,'europe-run-summary.json'),'utf8'));
 assert.equal(summary.marketCoverage.complete,false);
 assert.equal(summary.status,'INCOMPLETE');
 assert.ok(summary.marketCoverage.anomalies.some(x=>x.kind==='audit'&&x.shard===7&&x.issue==='REPORT_COUNT'));
 await fs.writeFile(path.join(reportDir,'daily-open-close-audit-7.json'),JSON.stringify({generatedAt:'2026-10-23T10:00:00Z',shardIndex:7,shardCount:8,markets:[]}));
 await fs.unlink(path.join(reportDir,'daily-open-close-update-7.json'));
 result=run();
 assert.equal(result.status,2,`Missing update shard must fail closed: ${result.stderr}`);
 summary=JSON.parse(await fs.readFile(path.join(reportDir,'europe-run-summary.json'),'utf8'));
 assert.equal(summary.marketCoverage.complete,false);
 assert.equal(summary.totals.failedImports,null,'Missing update report must not imply zero failed imports');
 assert.equal(summary.totals.deferredMissing,null);
 assert.equal(summary.totals.historicalBackfillFailures,null);
 assert.ok(summary.marketCoverage.anomalies.some(x=>x.kind==='update'&&x.shard===7&&x.issue==='REPORT_COUNT'));
 console.log('Europe summary integration PASS: runtime, historical debt, 8/8 coverage and missing update/audit shard fail-closed');
} finally {
 await fs.rm(fixture,{recursive:true,force:true});
}
