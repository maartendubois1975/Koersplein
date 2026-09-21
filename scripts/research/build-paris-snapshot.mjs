import fs from 'node:fs/promises';
import path from 'node:path';
import {parisResearchUniverse} from './paris-universe.mjs';
import {ParisResearchInput} from './paris-input.mjs';

const root=process.env.KOERSPLEIN_RESEARCH_DIR||'var/research';
const snapshotDir=path.join(root,'paris-v1','snapshot');
const universe=await parisResearchUniverse();
const concurrency=Math.max(1,Math.min(12,Number(process.env.KOERSPLEIN_SNAPSHOT_CONCURRENCY||4)));
const retries=Math.max(1,Number(process.env.KOERSPLEIN_SNAPSHOT_RETRIES||3));
await fs.mkdir(snapshotDir,{recursive:true});

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const safeName=isin=>path.join(snapshotDir,isin+'.json');
const results=new Array(universe.included.length);
let cursor=0;
async function fetchOne(x,index){
  let lastError=null;
  for(let attempt=1;attempt<=retries;attempt++){
    try{
      const input=new ParisResearchInput();
      let snap;
      try {
        const meta=await input.clientOrDefault().historyPartitions(x.isin);
        const bars=[];
        for(const p of meta.partitions||[]) bars.push(...(await input.clientOrDefault().historyPartition(x.isin,p.period)).bars);
        snap=await input.normalizeRaw({instrument:meta.instrument,provider:meta.provider,bars});
      } catch (e) {
        throw new Error(`bounded partition snapshot failed: ${e.message}`);
      }
      await fs.writeFile(safeName(x.isin),JSON.stringify(snap));
      results[index]={isin:x.isin,status:'COMPLETE',records:snap.records,firstDate:snap.firstDate,lastDate:snap.lastDate,attempt};
      return;
    }catch(e){lastError=e;if(attempt<retries)await sleep(750*attempt);}
  }
  results[index]={isin:x.isin,status:'FAILED',error:lastError?.message||'unknown'};
}
async function worker(){while(true){const i=cursor++;if(i>=universe.included.length)return;await fetchOne(universe.included[i],i);}}
await Promise.all(Array.from({length:concurrency},()=>worker()));
const complete=results.filter(x=>x?.status==='COMPLETE').length,failed=results.filter(x=>x?.status==='FAILED');
const manifest={schemaVersion:1,market:'PARIS',mic:'XPAR',createdAt:new Date().toISOString(),universe:universe.included.length,complete,failed:failed.length,files:results};
await fs.writeFile(path.join(snapshotDir,'manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({universe:manifest.universe,complete,failed:failed.length,failures:failed.slice(0,20)},null,2));
if(failed.length)process.exitCode=2;
