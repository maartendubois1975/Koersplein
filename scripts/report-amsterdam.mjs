import {readFile} from 'node:fs/promises';
const report=JSON.parse(await readFile(process.argv[2]||'amsterdam-candidates.json','utf8'));
const counts=Object.fromEntries(['candidates','noTrade','missing','errors'].map(key=>[key,report[key]?.length||0]));
const accounted=Object.values(counts).reduce((a,b)=>a+b,0);
if(accounted!==80)process.exitCode=1;
console.log(JSON.stringify({date:report.date,accounted,...counts,approved:report.approved,exceptions:[...(report.noTrade||[]).map(x=>({isin:x.isin,status:x.status})),...(report.missing||[]).map(x=>({isin:x.isin,status:x.status})),...(report.errors||[]).map(x=>({isin:x.isin,status:'ERROR',reason:x.error}))]},null,2));
