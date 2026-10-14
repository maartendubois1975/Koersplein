// Block 1 v2: immutable company/security/listing separation.
// Never infer a security type or an ISIN from a ticker or a venue suffix.
import {isValidIsin} from './isin-identity-core.mjs';
const norm=v=>String(v??'').trim();
export function normalizeCatalog(market,items){
 const securities=new Map(),listings=[],rejected=[],seenListings=new Set();
 for(const [index,item] of items.entries()){
  const ticker=norm(item.providerSymbol||item.symbol||item.ticker);
  const isin=norm(item.isin).toUpperCase();
  const mic=norm(item.mic||market.mic);
  const type=norm(item.securityType||item.instrumentType||item.type).toUpperCase();
  const evidence={source:item.securityTypeSource||item.instrumentTypeSource||null,url:item.securityTypeSourceUrl||item.instrumentTypeSourceUrl||null,verifiedAt:item.securityTypeVerifiedAt||item.instrumentTypeVerifiedAt||null};
  const issues=[];
  if(!ticker)issues.push('MISSING_LISTING_SYMBOL');
  if(!isin)issues.push('MISSING_ISIN');else if(!isValidIsin(isin))issues.push('INVALID_ISIN');
  if(!type||!evidence.source||!evidence.url||!evidence.verifiedAt)issues.push('UNVERIFIED_SECURITY_TYPE');
  const listingKey=market.mic+'|'+mic+'|'+ticker;
  if(seenListings.has(listingKey))issues.push('DUPLICATE_LISTING_KEY');
  seenListings.add(listingKey);
  if(issues.length){rejected.push({index,ticker,isin:isin||null,issues});continue;}
  const existing=securities.get(isin);
  if(existing&&existing.type!==type){rejected.push({index,ticker,isin,issues:['CONFLICTING_SECURITY_TYPE']});continue;}
  if(!existing)securities.set(isin,{securityId:'ISIN:'+isin,isin,type,typeEvidence:evidence});
  listings.push({listingId:listingKey,securityId:'ISIN:'+isin,marketMic:market.mic,segmentMic:mic,ticker,currency:item.currency||market.currency||null});
 }
 return {securities:[...securities.values()],listings,rejected,summary:{input:items.length,acceptedListings:listings.length,distinctSecurities:securities.size,rejected:rejected.length}};
}
