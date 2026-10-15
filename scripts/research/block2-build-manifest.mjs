import fs from 'node:fs/promises';
import {marketManifest} from './block2-identity-core.mjs';
const plan=JSON.parse(await fs.readFile('data/world-fill-plan.json','utf8'));
if(plan.markets?.length!==31||new Set(plan.markets.map(m=>m.mic)).size!==31)throw Error('EXPECTED_31_UNIQUE_MARKETS');
const markets=[];
const sourceInventory=[];
for(const market of plan.markets){
 try{
  const raw=JSON.parse(await fs.readFile('data/euronext-'+market.code+'.json','utf8'));
  const rows=Array.isArray(raw)?raw:(raw.shares||raw.instruments);
  const manifest=marketManifest(market,rows);
  markets.push(manifest);
  sourceInventory.push({mic:market.mic,catalogSourceUrl:typeof raw.source==='string'?raw.source:null,catalogRetrievedAt:raw.retrievedAt||null,catalogRows:manifest.total,sourceMetadataPresent:!!raw.source,externalSnapshotVerified:false});
 }catch(error){markets.push({mic:market.mic,total:0,certified:0,blocked:0,status:'CATALOG_ERROR',error:error.message});sourceInventory.push({mic:market.mic,catalogSourceUrl:null,catalogRetrievedAt:null,catalogRows:0,sourceMetadataPresent:false,externalSnapshotVerified:false,error:error.message});}
}
const report={schema:1,status:'OFFICIAL_VERIFICATION_REQUIRED',generatedAt:new Date().toISOString(),markets,sourceInventory,totals:{markets:markets.length,instruments:markets.reduce((n,m)=>n+(m.total||0),0),certified:0,blocked:markets.reduce((n,m)=>n+(m.blocked||0),0),catalogErrors:markets.filter(m=>m.status==='CATALOG_ERROR').length}};
await fs.mkdir('research/output/machine-arena',{recursive:true});
await fs.writeFile('research/output/machine-arena/block2-identity-manifest.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({status:report.status,totals:report.totals}));
process.exitCode=1;
