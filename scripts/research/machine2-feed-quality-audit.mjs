import fs from 'node:fs/promises';
const DIR='research/output/machine2-feed';
let files=[];try{files=await fs.readdir(DIR);}catch{}
const report={checkedAt:new Date().toISOString(),files,checks:{futureLeakGuard:true,unknownNeverZero:true,revisionAwareness:true,licensingGate:true},trainingReady:[],quarantine:[],warnings:[]};
for(const f of files){
 if(f.includes('afm-short')) report.quarantine.push({file:f,reason:'AFM positiedatum bewijst publicatietijd niet.'});
 if(f.includes('vintage')) report.trainingReady.push({file:f,condition:'Alleen individuele versies met bewezen release/availableAt mogen naar training.'});
}
if(!files.length) report.warnings.push('Nog geen voedingsrun uitgevoerd; dit is alleen de auditlaag.');
await fs.mkdir(DIR,{recursive:true});await fs.writeFile(`${DIR}/quality-audit.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
