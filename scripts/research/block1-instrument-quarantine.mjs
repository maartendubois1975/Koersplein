import fs from 'node:fs/promises';
import {isValidIsin} from './isin-identity-core.mjs';

// Evidence-based inventory only. Never infer security type from a company name,
// ticker, exchange suffix or ISIN country prefix.
const plan=JSON.parse(await fs.readFile('data/world-fill-plan.json','utf8'));
const output={schema:1,generatedAt:new Date().toISOString(),status:'NOT_VERIFIED',markets:[],totals:{instruments:0,verifiedCommonShares:0,quarantined:0,missingIsin:0,missingEquityCandidateIsin:0,nonEquityMissingIsin:0,invalidIsin:0,missingTypeEvidence:0,missingRegisterEvidence:0}};
const types=new Set(['COMMON_STOCK','ORDINARY_SHARE']);
const expectedMarkets=new Set(plan.markets.map(m=>m.mic));
if(expectedMarkets.size!==31 || plan.markets.length!==31)throw new Error('BLOCK1_EXPECTED_31_UNIQUE_MARKETS');
for(const market of plan.markets){
 const raw=JSON.parse(await fs.readFile('data/euronext-'+market.code+'.json','utf8'));
 const items=Array.isArray(raw)?raw:(raw.shares||raw.instruments||[]);
 if(!Array.isArray(items))throw new Error(`BLOCK1_INVALID_CATALOG_SHAPE:${market.mic}`);
 const rows=[];
 const listingKeys=new Set();
 for(const item of items){
  const isin=typeof item.isin==='string'?item.isin.trim():null;
  const type=String(item.instrumentType||item.securityType||item.type||'').toUpperCase();
  const source=item.instrumentTypeSource||item.securityTypeSource||item.classificationSource||null;
  const issues=[];
  const symbol=String(item.providerSymbol||item.symbol||item.ticker||'').trim();
  const listingKey=`${market.mic}:${symbol}`;
  if(!symbol)issues.push('MISSING_LISTING_SYMBOL');
  else if(listingKeys.has(listingKey))issues.push('DUPLICATE_LISTING_SYMBOL');
  listingKeys.add(listingKey);
  if(item.mic && item.mic!==market.mic)issues.push('MIC_REQUIRES_OFFICIAL_SEGMENT_REVIEW');
  if(!isin)issues.push('MISSING_ISIN');
  else if(!isValidIsin(isin))issues.push('INVALID_ISIN');
  if(!type||!source)issues.push('UNVERIFIED_SECURITY_TYPE');
  else if(!types.has(type))issues.push('NOT_VERIFIED_ORDINARY_SHARE');
  // A self-declared source label is not independent exchange evidence.
  // Promotion requires a traceable primary-source record and review metadata.
  const evidence=item.officialRegisterEvidence;
  const validEvidence=evidence && typeof evidence==='object' &&
    typeof evidence.sourceUrl==='string' && /^https:\/\//.test(evidence.sourceUrl) &&
    typeof evidence.recordId==='string' && evidence.recordId.trim().length>0 &&
    typeof evidence.verifiedAt==='string' && !Number.isNaN(Date.parse(evidence.verifiedAt)) &&
    typeof evidence.reviewer==='string' && evidence.reviewer.trim().length>0 &&
    evidence.isin===isin && evidence.mic===market.mic &&
    evidence.instrumentType===type;
  if(!validEvidence)issues.push('MISSING_INDEPENDENT_REGISTER_EVIDENCE');
  const accepted=issues.length===0;
  output.totals.instruments++;
  if(accepted)output.totals.verifiedCommonShares++;else output.totals.quarantined++;
  if(issues.includes('MISSING_ISIN')){
    output.totals.missingIsin++;
    if(type==='INDEX')output.totals.nonEquityMissingIsin++;
    else output.totals.missingEquityCandidateIsin++;
  }
  if(issues.includes('INVALID_ISIN'))output.totals.invalidIsin++;
  if(issues.includes('UNVERIFIED_SECURITY_TYPE'))output.totals.missingTypeEvidence++;
  if(issues.includes('MISSING_INDEPENDENT_REGISTER_EVIDENCE'))output.totals.missingRegisterEvidence++;
  rows.push({symbol:symbol||null,isin,declaredType:type||null,typeSource:source,eligible:accepted,issues});
 }
 output.markets.push({mic:market.mic,name:market.name,count:rows.length,verifiedCommonShares:rows.filter(x=>x.eligible).length,quarantined:rows.filter(x=>!x.eligible).length,records:rows});
}
output.status=output.totals.instruments===0?'BLOCKED_EMPTY_CATALOG':output.totals.quarantined?'BLOCKED_UNVERIFIED_INSTRUMENTS':'VERIFIED_STRUCTURE_ONLY';
await fs.mkdir('research/output/machine-arena',{recursive:true});
await fs.writeFile('research/output/machine-arena/block1-instrument-quarantine.json',JSON.stringify(output,null,2));
console.log(JSON.stringify({status:output.status,totals:output.totals,markets:output.markets.map(({mic,count,verifiedCommonShares,quarantined,records})=>({mic,count,verifiedCommonShares,quarantined,missingIsin:records.filter(r=>r.issues.includes('MISSING_ISIN')).length,invalidIsin:records.filter(r=>r.issues.includes('INVALID_ISIN')).length,nonEquityMissingIsin:records.filter(r=>r.declaredType==='INDEX'&&r.issues.includes('MISSING_ISIN')).length,missingEquityCandidateIsin:records.filter(r=>r.declaredType!=='INDEX'&&r.issues.includes('MISSING_ISIN')).length}))}));
if(output.totals.quarantined || output.totals.instruments===0)process.exitCode=1;
