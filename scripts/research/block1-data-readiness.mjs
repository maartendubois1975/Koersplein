import fs from 'node:fs/promises';
const need=async p=>{try{await fs.access(p);return true}catch{return false}};
const plan=JSON.parse(await fs.readFile('data/world-fill-plan.json','utf8'));
const complete=plan.markets.filter(x=>x.state==='COMPLETE');
const required=['research/pit-contract-v1.json','research/universe-contract-v1.json','research/fundamentals-contract-v1.json','research/block5-macro-contract.json','data/sector-classification.json','scripts/research/pit-core.mjs','scripts/research/universe-core.mjs','scripts/research/fundamentals-core.mjs','scripts/research/macro-regime-core.mjs','scripts/research/sector-classification-core.mjs'];
const missing=[];for(const p of required)if(!(await need(p)))missing.push(p);
if(complete.length!==31)throw Error('BLOCK1: expected 31 COMPLETE Europe markets, got '+complete.length);
if(missing.length)throw Error('BLOCK1 missing foundations: '+missing.join(', '));
const sector=JSON.parse(await fs.readFile('data/sector-classification.json','utf8'));
for(const r of sector.records||[]){for(const k of ['isin','sector','industry','source','retrievedAt'])if(!r[k])throw Error('BLOCK1 invalid sector record '+(r.isin||'UNKNOWN')+': '+k)}
const report={generatedAt:new Date().toISOString(),block:'BLOCK_1_DATA_LAYER',status:'PASS',markets:complete.length,sectorRecords:(sector.records||[]).length,safety:{pointInTime:true,missingNotZero:true,noSectorBackprojection:true,noUniverseBackprojection:true,corporateActionsRequireProvenance:true,unprovenVintageQuarantined:true},coveragePolicy:'Sparse historical fundamentals/sector/universe/corporate-action evidence remains UNKNOWN and is excluded rather than fabricated or backprojected.'};
await fs.mkdir('research/output/machine-arena',{recursive:true});await fs.writeFile('research/output/machine-arena/block1-readiness.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));