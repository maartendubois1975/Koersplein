// NYSE current universe from official Nasdaq Trader directory; no historical membership claim.
import fs from 'node:fs/promises';
import path from 'node:path';
import {parseUSDirectory} from './usa-directory-parse.mjs';
import {classifyUSListing, classifySummary, triageUSCatalogCandidate} from './usa-security-type.mjs';
const SOURCE='https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt';
const response=await fetch(SOURCE,{headers:{'User-Agent':'Koersplein-NYSE-universe/1.0'}});
if(!response.ok)throw Error('NYSE_DIRECTORY_HTTP_'+response.status);
const raw=await response.text();
const {rows,sourceTimestamp,sha256}=parseUSDirectory(raw,
 ['ACT Symbol','Security Name','Exchange','CQS Symbol','ETF','Test Issue','NASDAQ Symbol']);
const nyse=rows.filter(x=>x.Exchange==='N'&&x['Test Issue']==='N');
const excluded=nyse.filter(x=>x.ETF==='Y');
const eligible=nyse.filter(x=>x.ETF==='N').map(x=>{
 const classification=classifyUSListing({symbol:x['ACT Symbol'],name:x['Security Name'],etf:x.ETF,testIssue:x['Test Issue']});
 return {symbol:x['ACT Symbol'],name:x['Security Name'],exchange:'XNYS',
  isin:null,isinStatus:'NOT_IN_OFFICIAL_DIRECTORY',
  securityType:classification.type,securityTypeReason:classification.reason,
  ...triageUSCatalogCandidate(classification),
  cqsSymbol:x['CQS Symbol'],nasdaqSymbol:x['NASDAQ Symbol'],
  source:SOURCE,sourceTimestamp,priceHistoryStatus:'NOT_FETCHED',
  verifiedCommonStock:false,eligibleForTraining:false};
});
if(new Set(eligible.map(x=>x.symbol)).size!==eligible.length)throw Error('DUPLICATE_NYSE_SYMBOLS');
if(eligible.length<1000)throw Error('UNEXPECTEDLY_SMALL_NYSE_UNIVERSE:'+eligible.length);
const out='research/output/usa/XNYS';
await fs.mkdir(out,{recursive:true});
const generatedAt=new Date().toISOString();
await fs.writeFile(path.join(out,'universe.json'),JSON.stringify({
 generatedAt,source:SOURCE,sourceTimestamp,sourceSha256:sha256,exchange:'XNYS',snapshotOnly:true,securities:eligible},null,2));
await fs.writeFile(path.join(out,'coverage.json'),JSON.stringify({
 generatedAt,exchange:'XNYS',source:SOURCE,sourceTimestamp,sourceSha256:sha256,
 totalNYSEListings:nyse.length,excludedETFs:excluded.length,nonETFCandidates:eligible.length,
 classificationHints:classifySummary(eligible),
 quarantinedSecurityType:eligible.filter(x=>x.catalogStatus==='QUARANTINE_SECURITY_TYPE').length,
 verifiedCommonStocks:0,verifiedISINs:0,
 historicalBarsFetched:0,usableForTraining:0,historicalDelistedCoverageVerified:false,
 corporateActionsVerified:false,distributionRightsApproved:false,
 status:'UNIVERSE_ONLY_NOT_HISTORICALLY_VALIDATED',
 note:'Heuristic security types only; no ISIN in directory. Current listings exclude delisted securities; no PIT training approval.'},null,2));
console.log(JSON.stringify({totalNYSEListings:nyse.length,excludedETFs:excluded.length,
 nonETFCandidates:eligible.length,classificationHints:classifySummary(eligible),
 sourceTimestamp,sourceSha256:sha256,output:out},null,2));
