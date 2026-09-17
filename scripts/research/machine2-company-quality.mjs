import fs from 'node:fs/promises';
const file=process.argv[2];
if(!file) throw new Error('Gebruik: node machine2-company-quality.mjs <evidence.jsonl>');
const lines=(await fs.readFile(file,'utf8')).split(/\r?\n/).filter(Boolean);
const rows=lines.map(JSON.parse);const reasons={};let eligible=0,quarantined=0,leaks=0;
for(const r of rows){
  if(r.trainingEligible) eligible++; else {quarantined++;const k=r.quarantineReason||'UNSPECIFIED';reasons[k]=(reasons[k]||0)+1;}
  if(r.reportingPeriodEnd && r.availableAt && Date.parse(r.availableAt)<Date.parse(r.reportingPeriodEnd)) leaks++;
}
const report={records:rows.length,eligible,quarantined,quarantineReasons:reasons,potentialTemporalLeaks:leaks,pass:leaks===0};
console.log(JSON.stringify(report,null,2));
if(!report.pass) process.exitCode=2;
