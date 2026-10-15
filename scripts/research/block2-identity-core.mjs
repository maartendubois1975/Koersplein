import {createHash} from 'node:crypto';
import {isValidIsin} from './isin-identity-core.mjs';
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function listingIdentity(row, market) {
 const symbol=[row.providerSymbol,row.symbol,row.ticker].map(v=>String(v??'').trim()).find(Boolean)||'';
 const isin=String(row.isin||'').trim().toUpperCase();
 const type=String(row.instrumentType||row.securityType||row.type||'').toUpperCase();
 const issues=[];
 const declaredSymbols=[row.providerSymbol,row.symbol,row.ticker].map(v=>String(v??'').trim()).filter(Boolean);
 if(new Set(declaredSymbols.map(s=>s.toUpperCase())).size>1)issues.push('CONFLICTING_SYMBOL_FIELDS');
 if(!symbol)issues.push('MISSING_SYMBOL');
 if(!isin)issues.push('MISSING_ISIN');
 else if(!isValidIsin(isin))issues.push('INVALID_ISIN');
 if(row.mic&&row.mic!==market.mic)issues.push('WRONG_MIC');
 if(!['COMMON_STOCK','ORDINARY_SHARE'].includes(type))issues.push('UNVERIFIED_TYPE');
 const evidence=row.officialRegisterEvidence;
 if(!evidence||evidence.isin!==isin||evidence.mic!==market.mic||evidence.instrumentType!==type||!String(evidence.sourceUrl||'').startsWith('https://')||!evidence.recordId||!evidence.reviewer||!Number.isFinite(Date.parse(evidence.verifiedAt||'')))issues.push('MISSING_REGISTER_EVIDENCE');
 issues.push('INDEPENDENT_SOURCE_VERIFICATION_REQUIRED');
 const identity=isin&&symbol?{mic:market.mic,symbol,isin}:null;
 return {identity,identityHash:identity?hash(identity):null,declaredType:type,issues,certified:false};
}
export function marketManifest(market,rows) {
 if(!Array.isArray(rows))throw Error('INVALID_CATALOG_SHAPE');
 const seen=new Set();
 const identities=new Set();
 const listings=rows.map(row=>{
  const result=listingIdentity(row,market);
  const symbol=[row.providerSymbol,row.symbol,row.ticker].map(v=>String(v??'').trim()).find(Boolean)||'';
  if(symbol){if(seen.has(symbol))result.issues.push('DUPLICATE_SYMBOL');seen.add(symbol);}
  if(result.identityHash){if(identities.has(result.identityHash))result.issues.push('DUPLICATE_LISTING_IDENTITY');identities.add(result.identityHash);}
  return result;
 });
 return {schema:1,mic:market.mic,fingerprint:hash(listings),total:listings.length,certified:0,blocked:listings.length,listings};
}
