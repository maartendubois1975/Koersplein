import fs from 'node:fs/promises';
import {marketManifest,canonicalSymbol} from './block2-identity-core.mjs';
const plan=JSON.parse(await fs.readFile('data/world-fill-plan.json','utf8'));
if(plan.markets?.length!==31||new Set(plan.markets.map(m=>m.mic)).size!==31)throw Error('EXPECTED_31_UNIQUE_MARKETS');
const markets=[];
const sourceInventory=[];
const unresolvedSamples=[];
const sourceClaims=[];
const verificationBacklog=[];
const targetedRepairQueue=[];
const resolveSymbol=row=>canonicalSymbol(row)||null;
for(const market of plan.markets){
 try{
  const raw=JSON.parse(await fs.readFile('data/euronext-'+market.code+'.json','utf8'));
  const rows=Array.isArray(raw)?raw:(raw.shares||raw.instruments);
  const manifest=marketManifest(market,rows);
  markets.push(manifest);
  for(const [index,entry] of manifest.listings.entries()){
   const actionable=entry.issues.filter(issue=>['MISSING_SYMBOL','CONFLICTING_SYMBOL_FIELDS','MISSING_ISIN','INVALID_ISIN','WRONG_MIC','DUPLICATE_SYMBOL','DUPLICATE_LISTING_IDENTITY','UNSUBSTANTIATED_IDENTITY_SOURCE','PRIMARY_DOCUMENT_MATCH_REQUIRED'].includes(issue));
   if(actionable.length)targetedRepairQueue.push({mic:market.mic,row:index,symbol:resolveSymbol(rows[index]),isin:rows[index].isin||null,issues:actionable,identitySource:rows[index].identitySource||null});
  }
  verificationBacklog.push({mic:market.mic,missingIsin:manifest.listings.filter(x=>x.issues.includes('MISSING_ISIN')).length,conflictingSymbols:manifest.listings.filter(x=>x.issues.includes('CONFLICTING_SYMBOL_FIELDS')).length,duplicateSymbols:manifest.listings.filter(x=>x.issues.includes('DUPLICATE_SYMBOL')).length,missingSymbols:manifest.listings.filter(x=>x.issues.includes('MISSING_SYMBOL')).length,invalidIsin:manifest.listings.filter(x=>x.issues.includes('INVALID_ISIN')).length,missingRegisterEvidence:manifest.listings.filter(x=>x.issues.includes('MISSING_REGISTER_EVIDENCE')).length,unverifiedType:manifest.listings.filter(x=>x.issues.includes('UNVERIFIED_TYPE')).length,unsubstantiatedIdentitySource:manifest.listings.filter(x=>x.issues.includes('UNSUBSTANTIATED_IDENTITY_SOURCE')).length,primaryDocumentMatchRequired:manifest.listings.filter(x=>x.issues.includes('PRIMARY_DOCUMENT_MATCH_REQUIRED')).length});
  sourceClaims.push({mic:market.mic,withIdentitySource:rows.filter(r=>typeof r.identitySource==='string'&&r.identitySource.startsWith('https://')).length,withOfficialRegisterEvidence:rows.filter(r=>!!r.officialRegisterEvidence).length,withIsin:rows.filter(r=>!!r.isin).length,unsubstantiatedIdentitySource:rows.filter(r=>r.identitySourceClaimStatus==='UNSUBSTANTIATED_PER_INSTRUMENT').length,primaryDocumentMatches:rows.filter(r=>typeof r.identityEvidenceStatus==='string'&&r.identityEvidenceStatus.startsWith('PRIMARY_SOURCE_MATCH_CONFIRMED_')).length,sourceClaimsWithoutPerInstrumentProof:rows.filter(r=>r.identitySourceClaimStatus==='UNSUBSTANTIATED_PER_INSTRUMENT'||r.identityEvidenceStatus?.startsWith('SOURCE_NOT_VERIFIED')).length,total:rows.length});
  unresolvedSamples.push({mic:market.mic,samples:rows.map((row,i)=>({row:i,symbol:resolveSymbol(row),isin:row.isin||null,issues:manifest.listings[i].issues.filter(issue=>issue!=='INDEPENDENT_SOURCE_VERIFICATION_REQUIRED'),claimedIdentitySource:row.identitySource||null})).filter(x=>x.issues.length).slice(0,15)});
  sourceInventory.push({mic:market.mic,catalogSourceUrl:typeof raw.source==='string'?raw.source:null,catalogRetrievedAt:raw.retrievedAt||null,catalogRows:manifest.total,sourceMetadataPresent:!!raw.source,externalSnapshotVerified:false});
 }catch(error){markets.push({mic:market.mic,total:0,certified:0,blocked:0,status:'CATALOG_ERROR',error:error.message});sourceInventory.push({mic:market.mic,catalogSourceUrl:null,catalogRetrievedAt:null,catalogRows:0,sourceMetadataPresent:false,externalSnapshotVerified:false,error:error.message});}
}
const issueSummary=markets.map(m=>({mic:m.mic,total:m.total||0,issues:(m.listings||[]).flatMap(x=>x.issues||[]).reduce((acc,issue)=>(acc[issue]=(acc[issue]||0)+1,acc),{}),catalogError:m.error||null}));
const sourceAudit=sourceInventory.map(s=>({...s,sourceKind:s.catalogSourceUrl?.startsWith('https://')?'URL':s.catalogSourceUrl?'DESCRIPTIVE_TEXT':'MISSING',retrievalTimestampValid:!!s.catalogRetrievedAt&&Number.isFinite(Date.parse(s.catalogRetrievedAt)),sourceVerified:false}));
const marketReadiness=markets.map(m=>{
 const evidence=sourceClaims.find(s=>s.mic===m.mic);
 const backlog=verificationBacklog.find(s=>s.mic===m.mic);
 return {mic:m.mic,total:m.total||0,isinCoverage:m.total?Number(((evidence?.withIsin||0)/m.total*100).toFixed(2)):0,primaryDocumentMatches:evidence?.primaryDocumentMatches||0,unsubstantiatedClaims:evidence?.sourceClaimsWithoutPerInstrumentProof||0,missingIsin:backlog?.missingIsin||0,certified:0,readyForProduction:false,blocker:m.error||'INDEPENDENT_REGISTER_VERIFICATION_REQUIRED'};
});
const marketRepairPriority=marketReadiness.map(m=>{
 const backlog=verificationBacklog.find(v=>v.mic===m.mic);
 const critical=(backlog?.missingIsin||0)+(backlog?.invalidIsin||0)+(backlog?.duplicateSymbols||0)+(backlog?.missingSymbols||0);
 return {...m,criticalIdentityIssues:critical,verificationGap:m.total-m.primaryDocumentMatches,repairPriorityScore:critical*10+m.unsubstantiatedClaims*3+(m.total-m.primaryDocumentMatches)};
}).sort((a,b)=>b.repairPriorityScore-a.repairPriorityScore||a.mic.localeCompare(b.mic));
const priorityQueue=issueSummary.flatMap(m=>Object.entries(m.issues).filter(([issue])=>issue!=='INDEPENDENT_SOURCE_VERIFICATION_REQUIRED').map(([issue,count])=>({mic:m.mic,issue,count}))).sort((a,b)=>b.count-a.count||a.mic.localeCompare(b.mic)||a.issue.localeCompare(b.issue));
const report={schema:1,status:'OFFICIAL_VERIFICATION_REQUIRED',generatedAt:new Date().toISOString(),markets,sourceInventory,sourceAudit,sourceClaims,marketReadiness,marketRepairPriority,verificationBacklog,targetedRepairQueue,issueSummary,priorityQueue,unresolvedSamples,totals:{markets:markets.length,instruments:markets.reduce((n,m)=>n+(m.total||0),0),certified:0,blocked:markets.reduce((n,m)=>n+(m.blocked||0),0),catalogErrors:markets.filter(m=>m.status==='CATALOG_ERROR').length}};
await fs.mkdir('research/output/machine-arena',{recursive:true});
await fs.writeFile('research/output/machine-arena/block2-identity-manifest.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({status:report.status,totals:report.totals}));
process.exitCode=1;
