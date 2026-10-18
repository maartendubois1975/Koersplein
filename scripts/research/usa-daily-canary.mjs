// One-time read-only live research probe, invoked after official candidate snapshots.
import fs from 'node:fs/promises';
import path from 'node:path';
import {SAMPLES,lastFullSession,previousSession,inspectYahooChart,assertCurrentCanaryEvidence,canProbeCatalogCandidate} from './usa-daily-canary-core.mjs';
const session=lastFullSession(),previous=previousSession(session),root='research/output/usa';
const cache=new Map(),results=[];
for(const sample of SAMPLES){
 const {mic,symbol,providerTicker,category}=sample;
 const row={mic,symbol,providerTicker,category,session,previous,status:'NOT_TESTED',rightsApproved:false,officialIssuerAndISINVerified:false};
 try{
  if(!cache.has(mic))cache.set(mic,JSON.parse(await fs.readFile(path.join(root,mic,'universe.json'),'utf8')));
  const cat=cache.get(mic);
  const item=cat.securities.find(s=>s.symbol===symbol&&(mic!=='TXSE'||s.symbolSuffix===''));
  if(!item){row.status='NOT_IN_OFFICIAL_CANDIDATE_SNAPSHOT';results.push(row);continue;}
  row.catalogName=item.name||null;
  row.catalogSource=cat.source||cat.meta?.source||null;
  row.catalogSecurityType=item.securityType||null;
  row.catalogISIN=item.isin||null;
  row.catalogVerifiedCommon=item.verifiedCommonStock===true;
  row.catalogStatus=(mic==='TXSE'?item.status:item.catalogStatus)||null;
  if(!canProbeCatalogCandidate(item,mic)){
   row.status=mic==='TXSE'?'TXSE_NOT_COMMON_CANDIDATE':'NOT_COMMON_CANDIDATE';results.push(row);continue;
  }
  const start=Math.floor((Date.parse(session+'T00:00:00Z')-14*86400000)/1000);
  const end=Math.floor((Date.parse(session+'T00:00:00Z')+2*86400000)/1000);
  const url='https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(providerTicker)+'?period1='+start+'&period2='+end+'&interval=1d&includePrePost=false';
  const response=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 (compatible; Koersplein-research-probe/1.0)'},signal:AbortSignal.timeout(10000)});
  row.httpStatus=response.status;
  if(!response.ok){row.status='PROVIDER_HTTP_'+response.status;results.push(row);continue;}
  const body=await response.json();
  Object.assign(row,inspectYahooChart(body,{mic,providerTicker,session,previous}));
 }catch(e){row.status='PROBE_ERROR';row.error=String(e.message||e).slice(0,180);}
 results.push(row);console.log(JSON.stringify({mic,symbol,status:row.status,date:row.date||null,open:row.open||null,close:row.close||null}));
}
const coverage={generatedAt:new Date().toISOString(),session,previous,calendar:'RULE_BASED_NYSE_HOLIDAYS_NOT_OFFICIALLY_CERTIFIED',provider:'Yahoo chart v8 research probe',providerRights:'NOT_APPROVED_FOR_PRODUCTION_OR_REDISTRIBUTION',adjustmentPolicy:'NOT_VERIFIED',regularSessionPolicy:'NOT_INDEPENDENTLY_VERIFIED',sourceGateApproved:false,backfillApproved:false,publicationApproved:false,completeMarkets:0,byMIC:{}};
for(const mic of ['XNYS','XNAS','TXSE']){const rows=results.filter(r=>r.mic===mic);coverage.byMIC[mic]={sampled:rows.length,datedCurrent:rows.filter(r=>r.status==='DATED_OHLC_RESEARCH_ONLY').length,previousOnly:rows.filter(r=>r.status==='PREVIOUS_SESSION_ONLY').length,failures:rows.filter(r=>!['DATED_OHLC_RESEARCH_ONLY','PREVIOUS_SESSION_ONLY'].includes(r.status)).length,status:'NOT_SOURCE_APPROVED'};}
const output={coverage,results};
await fs.mkdir(root,{recursive:true});
await fs.writeFile(path.join(root,'daily-canary-'+session+'.json'),JSON.stringify(output,null,2));
console.log(JSON.stringify(coverage));
// Preserve JSON evidence before failing on a missing current-session canary.
assertCurrentCanaryEvidence(output);
