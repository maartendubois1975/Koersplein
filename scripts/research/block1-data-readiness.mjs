import fs from 'node:fs/promises';
const need=async p=>{try{await fs.access(p);return true}catch{return false}};
const plan=JSON.parse(await fs.readFile('data/world-fill-plan.json','utf8'));
const markets=plan.markets.filter(x=>x.state==='COMPLETE');
const required=['research/pit-contract-v1.json','research/universe-contract-v1.json','research/fundamentals-contract-v1.json','research/block5-macro-contract.json','data/sector-classification.json','scripts/research/pit-core.mjs','scripts/research/universe-core.mjs','scripts/research/fundamentals-core.mjs','scripts/research/macro-regime-core.mjs','scripts/research/sector-classification-core.mjs'];
const missing=[];for(const p of required)if(!(await need(p)))missing.push(p);
if(markets.length!==31)throw Error('BLOCK1: expected 31 COMPLETE Europe markets, got '+markets.length);
if(missing.length)throw Error('BLOCK1 missing foundations: '+missing.join(', '));
const sector=JSON.parse(await fs.readFile('data/sector-classification.json','utf8'));
for(const r of sector.records||[])for(const k of ['isin','sector','industry','source','retrievedAt'])if(!r[k])throw Error('BLOCK1 invalid sector record '+(r.isin||'UNKNOWN')+': '+k);
const rows=[];for(const m of markets){
 const file=`data/euronext-${m.code}.json`;
 try{
  const raw=JSON.parse(await fs.readFile(file,'utf8'));
  const shares=Array.isArray(raw)?raw:(raw.shares||raw.instruments||[]);
  const known=shares.filter(x=>typeof x.isin==='string'&&x.isin.trim());
  const keys=shares.map(x=>String(x.providerSymbol||x.symbol||x.ticker||'').trim());
  const uniqueIsins=new Set(known.map(x=>x.isin.trim()));
  const duplicates=known.length-uniqueIsins.size;
  const missingListing=keys.filter(x=>!x).length;
  const duplicateListings=keys.length-new Set(keys.filter(Boolean)).size-missingListing;
  const verifiedSymbolFallback=shares.filter(x=>!x.isin&&x.providerSymbol&&x.identitySource&&x.identityResolution).length;
  const status=!shares.length||duplicates||missingListing||duplicateListings?'INVALID_CATALOG':known.length===shares.length?'IDENTITIES_PRESENT':'PARTIAL_IDENTITIES';
  rows.push({mic:m.mic,market:m.name,declaredState:m.state,catalog: file,instruments:shares.length,verifiedIsin:known.length,missingIsin:shares.length-known.length,verifiedSymbolFallback,duplicateKnownIsin:duplicates,missingListing,duplicateListings,status,historyCoverage:'NOT_MEASURED_BY_CATALOG_AUDIT'});
 }catch(e){rows.push({mic:m.mic,market:m.name,status:'CATALOG_ERROR',error:e.message})}
}
const invalid=rows.filter(x=>x.status==='INVALID_CATALOG'||x.status==='CATALOG_ERROR');
const partial=rows.filter(x=>x.status==='PARTIAL_IDENTITIES');
const report={generatedAt:new Date().toISOString(),block:'BLOCK_1_DATA_LAYER',status:invalid.length?'FAIL':partial.length?'PARTIAL_IDENTITIES':'CATALOG_IDENTITIES_PRESENT',markets:markets.length,sectorRecords:(sector.records||[]).length,totals:{instruments:rows.reduce((s,x)=>s+(x.instruments||0),0),verifiedIsin:rows.reduce((s,x)=>s+(x.verifiedIsin||0),0),missingIsin:rows.reduce((s,x)=>s+(x.missingIsin||0),0),marketsPartial:partial.length,marketsInvalid:invalid.length},marketCoverage:rows,limitations:['Catalog identity audit does not prove historical bars','COMPLETE state is not historical research readiness','Historical membership and delisted universe coverage not proven'],safety:{pointInTime:true,missingNotZero:true,noSectorBackprojection:true,noUniverseBackprojection:true,corporateActionsRequireProvenance:true,unprovenVintageQuarantined:true}};
await fs.mkdir('research/output/machine-arena',{recursive:true});
await fs.writeFile('research/output/machine-arena/block1-readiness.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(invalid.length)process.exitCode=1;
