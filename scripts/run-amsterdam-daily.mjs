import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {latestCandidateSession} from './amsterdam-session.mjs';
import {collect} from './fetch-amsterdam.mjs';
import {planAmsterdamImport} from './amsterdam-import-plan.mjs';
const manifest=JSON.parse(await readFile(new URL('../data/amsterdam-history-manifest.json',import.meta.url),'utf8'));
const ids=Object.keys(manifest.instruments);
if(ids.length!==80)throw Error('Expected 80 instruments');
const lastDates=[];
for(const isin of ids){
 const h=JSON.parse(await readFile(new URL('../data/history/'+isin+'.json',import.meta.url),'utf8'));
 if(h.instrument?.isin!==isin||h.instrument?.symbol!==manifest.instruments[isin].symbol)throw Error('History identity mismatch '+isin);
 lastDates.push(h.coverage.lastDate);
}
const plan=planAmsterdamImport(lastDates,latestCandidateSession());
const run=(name,args)=>execFileSync(process.execPath,[new URL(name,import.meta.url).pathname,...args],{encoding:'utf8',maxBuffer:10485760});
const report=[];
try{
 for(const date of plan.sessions){
  const raw=await collect(manifest,date);
  await writeFile('amsterdam-candidates.json',JSON.stringify(raw,null,2));
  let output;
  try{output=run('report-amsterdam.mjs',['amsterdam-candidates.json']);}
  catch(error){
   if(error.status!==1)throw error;
   output=error.stdout?.toString()||'';
  }
  let summary;
  try{summary=JSON.parse(output);}catch{throw Error('Unparseable coverage report '+date);}
  if(summary.market!=='XAMS'||summary.date!==date||summary.expected!==80||summary.accounted!==80||!summary.complete)throw Error('Invalid 80-instrument coverage '+date);
  await writeFile('amsterdam-summary.json',output);
  // Coverage accounting does not mean successful retrieval: technical errors must never count as a completed import.
  if(!Array.isArray(raw.errors)||raw.errors.length>0)throw Error('Amsterdam source retrieval failed for '+date+': '+JSON.stringify(raw.errors));
  run('verify-amsterdam.mjs',['amsterdam-candidates.json','amsterdam-verified.json']);
  const verified=JSON.parse(await readFile('amsterdam-verified.json','utf8'));
  if(verified.market!=='XAMS'||verified.date!==date||!Array.isArray(verified.rows)||!Array.isArray(verified.rejected)||verified.rows.length!==raw.candidates.length)throw Error('Amsterdam verified row count or identity mismatch '+date);
  if(verified.rejected.length)throw Error('Amsterdam verification rejected '+verified.rejected.length+' candidates on '+date+': '+JSON.stringify(verified.rejected));
  const result=JSON.parse(run('import-amsterdam.mjs',['amsterdam-verified.json','--apply']));
  report.push({date,candidates:raw.candidates.length,noTrade:raw.noTrade.length,missing:raw.missing.length,errors:raw.errors.length,verified:verified.rows.length,imported:result.approved,skipped:result.skipped});
  console.log(JSON.stringify(report.at(-1)));
 }
}finally{
 await writeFile('amsterdam-import.json',JSON.stringify({...plan,processedSessions:report.length,days:report},null,2)+'\n');
}
