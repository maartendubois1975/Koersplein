import fs from 'node:fs/promises';
import {marketManifest} from './block2-identity-core.mjs';
const plan=JSON.parse(await fs.readFile('data/world-fill-plan.json','utf8'));
if(plan.markets?.length!==31||new Set(plan.markets.map(m=>m.mic)).size!==31)throw Error('EXPECTED_31_UNIQUE_MARKETS');
const markets=[];
const sourceInventory=[];
const unresolvedSamples=[];
for(const market of plan.markets){
 try{
  const raw=JSON.parse(await fs.readFile('data/euronext-'+market.code+'.json','utf8'));
  const rows=Array.isArray(raw)?raw:(raw.shares||raw.instruments);
  const manifest=marketManifest(market,rows);
  markets.push(manifest);
  unresolvedSamples.push({mic:market.mic,samples:rows.map((row,i)=>({row:i,symbol:row.providerSymbol||row.symbol||row.ticker||null,isin:row.isin||null,issues:manifest.listings[i].issues.filter(issue=>issue!=='INDEPENDENT_SOURCE_VERIFICATION_REQUIRED'),claimedIdentitySource:row.identitySource||null})).filter(x=>x.issues.length).slice(0,15)});
  sourceInventory.push({mic:market.mic,catalogSourceUrl:typeof raw.source==='string'?raw.source:null,catalogRetrievedAt:raw.retrievedAt||null,catalogRows:manifest.total,sourceMetadataPresent:!!raw.source,externalSnapshotVerified:false});
 }catch(error){markets.push({mic:market.mic,total:0,certified:0,blocked:0,status:'CATALOG_ERROR',error:error.message});sourceInventory.push({mic:market.mic,catalogSourceUrl:null,catalogRetrievedAt:null,catalogRows:0,sourceMetadataPresent:false,externalSnapshotVerified:false,error:error.message});}
}
const issueSummary=markets.map(m=>({mic:m.mic,total:m.total||0,issues:(m.listings||[]).flatMap(x=>x.issues||[]).reduce((acc,issue)=>(acc[issue]=(acc[issue]||0)+1,acc),{}),catalogError:m.error||null}));
const sourceAudit=sourceInventory.map(s=>({...s,sourceKind:s.catalogSourceUrl?.startsWith('https://')?'URL':s.catalogSourceUrl?'DESCRIPTIVE_TEXT':'MISSING',retrievalTimestampValid:!!s.catalogRetrievedAt&&Number.isFinite(Date.parse(s.catalogRetrievedAt)),sourceVerified:false}));
const priorityQueue=issueSummary.flatMap(m=>Object.entries(m.issues).filter(([issue])=>issue!=='INDEPENDENT_SOURCE_VERIFICATION_REQUIRED').map(([issue,count])=>({mic:m.mic,issue,count}))).sort((a,b)=>b.count-a.count||a.mic.localeCompare(b.mic)||a.issue.localeCompare(b.issue));
const report={schema:1,status:'OFFICIAL_VERIFICATION_REQUIRED',generatedAt:new Date().toISOString(),markets,sourceInventory,sourceAudit,issueSummary,priorityQueue,unresolvedSamples,totals:{markets:markets.length,instruments:markets.reduce((n,m)=>n+(m.total||0),0),certified:0,blocked:markets.reduce((n,m)=>n+(m.blocked||0),0),catalogErrors:markets.filter(m=>m.status==='CATALOG_ERROR').length}};
await fs.mkdir('research/output/machine-arena',{recursive:true});
await fs.writeFile('research/output/machine-arena/block2-identity-manifest.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({status:report.status,totals:report.totals}));
process.exitCode=1;
