// Fail-closed filter: non-ETF catalog entries are not automatically active ordinary shares.
const ISIN=/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
const COMMON=new Set(['COMMON_CANDIDATE','COMMON_VERIFIED']);
const HTTPS=/^https:\/\/[^\s]+$/i;
export function selectVerifiedNYSEHistoryUniverse(securities) {
  if(!Array.isArray(securities))throw Error('INVALID_NYSE_UNIVERSE');
  const approved=[],quarantined=[],seen=new Set();
  for(const item of securities) {
    const symbol=typeof item?.symbol==='string'?item.symbol.trim():'';
    const reasons=[];
    if(!symbol||seen.has(symbol))reasons.push('MISSING_OR_DUPLICATE_SYMBOL');
    if(symbol)seen.add(symbol);
    if(item?.exchange!=='XNYS')reasons.push('WRONG_MIC');
    if(!COMMON.has(item?.securityType)||item?.verifiedCommonStock!==true)reasons.push('COMMON_STOCK_NOT_VERIFIED');
    if(item?.officialListingVerified!==true||item?.officialListingStatus!=='ACTIVE')reasons.push('LISTING_NOT_VERIFIED');
    if(item?.activeTradingVerified!==true||item?.officialTradingStatus!=='ACTIVE')reasons.push('TRADING_NOT_VERIFIED');
    if(item?.issuerIdentityVerified!==true||item?.shareClassVerified!==true||!item?.shareClass)reasons.push('ISSUER_OR_CLASS_NOT_VERIFIED');
    if(item?.isinVerified!==true||!ISIN.test(item?.isin||''))reasons.push('ISIN_NOT_VERIFIED');
    if(!HTTPS.test(item?.listingEvidenceUrl||'')||!HTTPS.test(item?.tradingEvidenceUrl||''))reasons.push('EVIDENCE_MISSING');
    if(reasons.length)quarantined.push({symbol:symbol||null,reasons});else approved.push(item);
  }
  return {approved,quarantined};
}
