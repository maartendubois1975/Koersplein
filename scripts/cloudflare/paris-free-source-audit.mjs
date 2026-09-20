import fs from 'node:fs/promises';
const v=JSON.parse(await fs.readFile('research/output/paris/validation-summary.json','utf8'));
const d=JSON.parse(await fs.readFile('research/output/paris/free-source-dossier.json','utf8'));
if(d.status!=='APPROVED')throw Error('Parijs gratis-brondossier niet goedgekeurd');
if(v.invalidCount!==0)throw Error(`Parijs bevat ${v.invalidCount} ongeldige opgeslagen reeksen`);
const report={generatedAt:new Date().toISOString(),market:'PARIS',storedValid:v.researchEligible,explicitFreeSourceResearch:v.alternativeSourceRequired,invalid:v.invalidCount,freeSourcePolicy:d.status,gate:v.invalidCount===0?'PASS':'FAIL'};
await fs.writeFile('research/output/paris/free-source-audit.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
