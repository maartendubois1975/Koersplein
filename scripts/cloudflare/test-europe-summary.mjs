import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const script=path.resolve('scripts/cloudflare/summarize-europe-run.mjs');
const plan=JSON.parse(await fs.readFile('data/world-fill-plan.json','utf8'));
const complete=plan.markets.filter(m=>m.state==='COMPLETE');
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'koersplein-summary-'));
try{
 await fs.mkdir(path.join(dir,'research/output'),{recursive:true});
 await fs.mkdir(path.join(dir,'data'),{recursive:true});
 await fs.writeFile(path.join(dir,'data/world-fill-plan.json'),JSON.stringify(plan));
 for(let shardIndex=0;shardIndex<8;shardIndex++){
  const common={generatedAt:'2026-10-17T09:00:00Z',shardIndex,shardCount:8,freshnessCutoff:'2026-10-16'};
  const markets=complete.filter((_,index)=>index%8===shardIndex);
  const updateMarkets=markets.map(m=>({mic:m.mic,failed:[],deferredMissing:0}));
  const auditMarkets=markets.map((m,index)=>({mic:m.mic,catalog:1,openCloseOk:shardIndex===0&&index===0?0:1,missingOpenClose:0,skippedDataUnavailable:shardIndex===0&&index===0?1:0,missing:[]}));
  await fs.writeFile(path.join(dir,`research/output/daily-open-close-update-${shardIndex}.json`),JSON.stringify({...common,markets:updateMarkets}));
  await fs.writeFile(path.join(dir,`research/output/daily-open-close-audit-${shardIndex}.json`),JSON.stringify({...common,markets:auditMarkets}));
 }
 let r=spawnSync(process.execPath,[script],{cwd:dir,encoding:'utf8'});
 assert.equal(r.status,2,'unverified old exclusions must prevent green completion: '+r.stderr);
 const repaired=complete.filter((_,index)=>index%8===0).map(m=>({mic:m.mic,catalog:1,openCloseOk:1,missingOpenClose:0,skippedDataUnavailable:0,missing:[]}));
 await fs.writeFile(path.join(dir,'research/output/daily-open-close-audit-0-attempt-2.json'),JSON.stringify({generatedAt:'2026-10-17T10:00:00Z',shardIndex:0,shardCount:8,freshnessCutoff:'2026-10-16',markets:repaired}));
 r=spawnSync(process.execPath,[script],{cwd:dir,encoding:'utf8'});
 assert.equal(r.status,0,r.stderr+'\n'+r.stdout);
 const report=JSON.parse(await fs.readFile(path.join(dir,'research/output/europe-run-summary.json')));
 assert.equal(report.totals.catalog,complete.length);
 assert.equal(report.marketCoverage.complete,true);
 assert.equal(report.sessionConsistency.complete,true);
 assert.equal(report.freshnessCutoff,'2026-10-16');
 assert.equal(report.historyCompleteness,'NOT_PROVEN_BY_DAILY_AUDIT');
}finally{await fs.rm(dir,{recursive:true,force:true});}
console.log('Europe summary: exact 31-market eight-shard coverage, old exclusions and newest retry PASS');
