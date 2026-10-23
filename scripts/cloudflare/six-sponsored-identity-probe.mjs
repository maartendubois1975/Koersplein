// Read-only official SIX admission cross-check for already validated Yahoo evidence.
// No data scraping loops, no production writes, no automatic ticker promotion.
import fs from 'node:fs/promises';
import {SIX_SPONSORED_SOURCE,parseSixSponsoredAdmissions,compareSixSponsoredWithYahoo} from './six-sponsored-reference.mjs';
const input=process.env.SIX_YAHOO_EVIDENCE_PATH||'research/output/swiss-base/openfigi-yahoo-verification.json';
const output='research/output/six-sponsored-identity-evidence.json';
const yahoo=JSON.parse(await fs.readFile(input,'utf8'));
const request=JSON.parse(await fs.readFile('config/openfigi-yahoo-verify-request.json','utf8'));
if(request.mode!=='READ_ONLY_REFERENCE_VALIDATION'||!Number.isSafeInteger(request.sourceRunId)||!Number.isSafeInteger(request.swissYahooRunId)||request.swissYahooRunId<1)throw Error('Invalid read-only SIX evidence source configuration');
if(yahoo.mode!=='READ_ONLY_NO_CATALOG_OR_HISTORY_WRITES'||!Array.isArray(yahoo.results)||yahoo.sourceRunId!==request.sourceRunId||yahoo.offset!==0||!yahoo.results.some(x=>x?.mic==='XSWX'))throw Error('SIX source evidence is not the matching first-page Swiss Yahoo validation artifact');
let status='SOURCE_UNAVAILABLE',error=null,officialRows=[],results=[];
try{
 const r=await fetch(SIX_SPONSORED_SOURCE,{signal:AbortSignal.timeout(25000),headers:{Accept:'text/html','User-Agent':'Koersplein-official-identity-research/1.0'}});
 if(!r.ok)throw Error('SIX admissions HTTP '+r.status);
 officialRows=parseSixSponsoredAdmissions(await r.text());
 if(officialRows.length<50)throw Error('SIX admissions HTML did not contain a credible full listing: '+officialRows.length);
 results=compareSixSponsoredWithYahoo(yahoo.results,officialRows);
 status='OFFICIAL_ADMISSIONS_EVIDENCE_ONLY';
}catch(e){error=String(e.message||e).slice(0,250);}
const counts=results.reduce((a,x)=>(a[x.status]=(a[x.status]||0)+1,a),{});
const report={generatedAt:new Date().toISOString(),mode:'READ_ONLY_NO_PRODUCTION_WRITES',status,sourceUrl:SIX_SPONSORED_SOURCE,yahooEvidenceRunId:yahoo.sourceRunId,yahooEvidenceGeneratedAt:yahoo.generatedAt,officialRows:officialRows.length,swissCandidates:yahoo.results.filter(x=>x.mic==='XSWX').length,counts,results,error,warning:'Official admissions identify ISIN/ticker/currency but SIX licensing and source currency line must be reviewed before production redistribution. No history or catalog writes.'};
await fs.mkdir('research/output',{recursive:true});
await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log('SIX_SPONSORED_READ_ONLY',JSON.stringify({status,officialRows:report.officialRows,swissCandidates:report.swissCandidates,counts,error}));
if(status!=='OFFICIAL_ADMISSIONS_EVIDENCE_ONLY')process.exitCode=2;
