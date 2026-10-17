import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const script=path.resolve('scripts/cloudflare/summarize-europe-run.mjs'),dir=await fs.mkdtemp(path.join(os.tmpdir(),'koersplein-summary-'));
try{
 await fs.mkdir(path.join(dir,'research/output'),{recursive:true});
 for(let shardIndex=0;shardIndex<8;shardIndex++){
  const common={generatedAt:'2026-10-17T09:00:00Z',shardIndex};
  await fs.writeFile(path.join(dir,`research/output/daily-open-close-update-${shardIndex}.json`),JSON.stringify({...common,markets:[{failed:[],deferredMissing:0}]}));
  await fs.writeFile(path.join(dir,`research/output/daily-open-close-audit-${shardIndex}.json`),JSON.stringify({...common,markets:[{catalog:1,openCloseOk:shardIndex?1:0,missingOpenClose:0,skippedDataUnavailable:shardIndex?0:1}]}));
 }
 let r=spawnSync(process.execPath,[script],{cwd:dir,encoding:'utf8'});assert.equal(r.status,2,'unverified old exclusions must prevent green completion');
 await fs.writeFile(path.join(dir,'research/output/daily-open-close-audit-0-attempt-2.json'),JSON.stringify({generatedAt:'2026-10-17T10:00:00Z',shardIndex:0,markets:[{catalog:1,openCloseOk:1,missingOpenClose:0,skippedDataUnavailable:0}]}));
 r=spawnSync(process.execPath,[script],{cwd:dir,encoding:'utf8'});assert.equal(r.status,0,r.stderr);
 const report=JSON.parse(await fs.readFile(path.join(dir,'research/output/europe-run-summary.json')));assert.equal(report.totals.catalog,8);assert.equal(report.historyCompleteness,'NOT_PROVEN_BY_DAILY_AUDIT');
}finally{await fs.rm(dir,{recursive:true,force:true});}
console.log('Europe summary: old exclusions remain incomplete; newest retry replaces prior shard report without double counting OK');
