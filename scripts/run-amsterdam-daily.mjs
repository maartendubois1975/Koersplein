import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {latestCandidateSession} from './amsterdam-session.mjs';
import {collect} from './fetch-amsterdam.mjs';
const manifest=JSON.parse(await readFile(new URL('../data/amsterdam-history-manifest.json',import.meta.url),'utf8'));
let oldest=null;
for(const isin of Object.keys(manifest.instruments)){const h=JSON.parse(await readFile(new URL('../data/history/'+isin+'.json',import.meta.url),'utf8'));const d=h.coverage.lastDate;if(!oldest||d<oldest)oldest=d;}
const end=latestCandidateSession(),days=[];
for(let d=new Date(oldest+'T00:00:00Z');d.toISOString().slice(0,10)<end;){d.setUTCDate(d.getUTCDate()+1);if(d.getUTCDay()!==0&&d.getUTCDay()!==6)days.push(d.toISOString().slice(0,10));}
if(days.length>30)throw Error('Backlog exceeds 30 sessions');
const run=(name,args)=>execFileSync(process.execPath,[new URL(name,import.meta.url).pathname,...args],{encoding:'utf8',maxBuffer:10485760});
const report=[];
for(const date of days){
 const raw=await collect(manifest,date);
 await writeFile('amsterdam-candidates.json',JSON.stringify(raw,null,2));
 // Coverage report is diagnostic: incomplete source coverage must not block valid stocks.
 let coverageReport;
 try {
  coverageReport=run('report-amsterdam.mjs',['amsterdam-candidates.json']);
 } catch(error) {
  if(error.status!==1)throw error;
  coverageReport=error.stdout?.toString()||'';
  if(!coverageReport.trim())throw error;
 }
 await writeFile('amsterdam-summary.json',coverageReport);
 run('verify-amsterdam.mjs',['amsterdam-candidates.json','amsterdam-verified.json']);
 const result=JSON.parse(run('import-amsterdam.mjs',['amsterdam-verified.json','--apply','--partial']));
 report.push({date,valid:raw.candidates.length,errors:raw.errors.length,missing:raw.missing.length,imported:result.approved,skipped:result.skipped});
 console.log(JSON.stringify(report.at(-1)));
}
await writeFile('amsterdam-import.json',JSON.stringify({from:oldest,to:end,days:report},null,2));
