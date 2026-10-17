import {classifyUSListing} from './usa-security-type.mjs';

const HEADER='SymbolRoot|SymbolSuffix|SymbolID|StreamID|LotSize|IsTest|ETF|TXSEListed';
// Named, effective-dated secondary-listing evidence. TXSEListed=N neither
// proves listing nor disproves a separately announced dual listing.
const SECONDARY_LISTING_EVIDENCE=Object.freeze({
  'SCHW|':Object.freeze({
    issuer:'The Charles Schwab Corporation',cik:'0000316709',
    primaryMic:'XNYS',effectiveDate:'2026-10-07',securityClass:'Common Stock',
    txseNotice:'https://www.txse.com/alerts/b73ae818-f4d2-4437-8cc9-8370719ecbe2',
    secForm8A:'https://www.sec.gov/Archives/edgar/data/316709/000119312526415008/d42491d8a12b.htm'
  })
});
export function parseTXSESymbols(raw) {
  if(typeof raw!=='string'||!raw.trim()) throw Error('TXSE_EMPTY_SOURCE');
  const lines=raw.trimEnd().replace(/\r/g,'').split('\n');
  if(lines.shift()!==HEADER) throw Error('TXSE_UNEXPECTED_HEADER');
  const rows=[], seen=new Set();
  for(const [i,line] of lines.entries()){
    if(!line) throw Error('TXSE_EMPTY_ROW:'+(i+2));
    const v=line.split('|');
    if(v.length!==8) throw Error('TXSE_MALFORMED_ROW:'+(i+2));
    const [root,suffix,id,stream,lot,test,etf,listed]=v;
    if(!/^[A-Z0-9][A-Z0-9.]*$/.test(root)||!/^[A-Z0-9]*$/.test(suffix)) throw Error('TXSE_INVALID_SYMBOL:'+(i+2));
    if(![id,stream,lot].every(x=>/^[1-9]\d*$/.test(x))) throw Error('TXSE_INVALID_NUMERIC_FIELD:'+(i+2));
    if(![test,etf,listed].every(x=>x==='Y'||x==='N')) throw Error('TXSE_INVALID_FLAG:'+(i+2));
    const key=root+'|'+suffix;
    if(seen.has(key)) throw Error('TXSE_DUPLICATE_SYMBOL:'+key);
    seen.add(key);
    rows.push({symbolRoot:root,symbolSuffix:suffix,symbolKey:key,symbolID:id,streamID:stream,lotSize:Number(lot),isTest:test,etf,txseListed:listed});
  }
  if(!rows.length) throw Error('TXSE_NO_ROWS');
  return rows;
}

export function buildTXSECatalog(rows,otherlisted,meta) {
  if(!Array.isArray(rows)||!Array.isArray(otherlisted)) throw Error('TXSE_INVALID_INPUT');
  const bySymbol=new Map();
  for(const r of otherlisted){
    const key=r['ACT Symbol'];
    if(!key) continue;
    if(bySymbol.has(key)) throw Error('TXSE_DUPLICATE_CROSSCHECK_SYMBOL:'+key);
    bySymbol.set(key,r);
  }
  const snapshotDate=/^\d{4}-\d{2}-\d{2}T/.test(meta?.observedAt||'')?meta.observedAt.slice(0,10):null;
  const evidenceFor=r=>r.symbolSuffix===''&&snapshotDate&&SECONDARY_LISTING_EVIDENCE[r.symbolKey]?.effectiveDate<=snapshotDate
    ?SECONDARY_LISTING_EVIDENCE[r.symbolKey]:null;
  const listed=rows.filter(r=>r.txseListed==='Y');
  const evidencedSecondary=rows.filter(r=>r.txseListed==='N'&&evidenceFor(r));
  const securities=[...listed,...evidencedSecondary].map(r=>{
    const match=r.symbolSuffix===''?bySymbol.get(r.symbolRoot):null;
    const type=match?classifyUSListing({symbol:match['ACT Symbol'],name:match['Security Name'],etf:match.ETF,testIssue:match['Test Issue']}):null;
    const secondary=evidenceFor(r);
    const issuerMatches=!secondary||/\bCharles Schwab Corporation\b/i.test(match?.['Security Name']||'');
    let status='QUARANTINE_NO_MATCHING_OFFICIAL_NAME';
    if(r.isTest==='Y')status='EXCLUDED_TEST';
    else if(r.etf==='Y')status='EXCLUDED_ETF';
    else if(r.symbolSuffix)status='QUARANTINE_SUFFIX_SHARE_CLASS';
    else if(!match)status='QUARANTINE_NO_MATCHING_OFFICIAL_NAME';
    else if(!issuerMatches)status='QUARANTINE_ISSUER_IDENTITY_MISMATCH';
    else if(match.Exchange!=='F'&&!(secondary&&match.Exchange==='N'))status='QUARANTINE_PRIMARY_EXCHANGE_CONFLICT';
    else if(match.ETF!=='N'||match['Test Issue']!=='N')status='QUARANTINE_DIRECTORY_FLAGS';
    else if(type.type!=='COMMON_CANDIDATE')status='QUARANTINE_SECURITY_TYPE';
    else status='COMMON_CANDIDATE_NOT_VERIFIED';
    return {symbol:r.symbolRoot,symbolSuffix:r.symbolSuffix,symbolKey:r.symbolKey,mic:'TXSE',
      txseListed:r.txseListed==='Y',txseTradableInSnapshot:true,
      listingEvidence:secondary?'TXSE_SECONDARY_NOTICE_AND_SEC_8A':'TXSE_LISTED_FLAG',
      listingEffectiveDate:secondary?.effectiveDate||null,primaryMic:secondary?.primaryMic||null,
      issuerCIK:secondary?.cik||null,listingSourceUrls:secondary?[secondary.txseNotice,secondary.secForm8A]:[],
      listingStatus:secondary?'SECONDARY_LISTING_ANNOUNCED_ACTIVE_NOT_VERIFIED':'LISTED_FLAG_ACTIVE_NOT_VERIFIED',
      name:match?.['Security Name']||null,primaryDirectoryExchange:match?.Exchange||null,
      securityType:type?.type||null,securityTypeReason:type?.reason||null,status,
      isin:null,isinStatus:'UNVERIFIED',activeTradingStatus:'UNVERIFIED',
      verifiedCommonStock:false,eligibleForTraining:false};
  });
  const counts=Object.fromEntries([...new Set(securities.map(x=>x.status))].sort().map(k=>[k,securities.filter(x=>x.status===k).length]));
  return {securities,summary:{mic:'TXSE',status:'RESEARCH_ONLY_CATALOG_NOT_VERIFIED',source:meta.source,
    sourceSha256:meta.sourceSha256,observedAt:meta.observedAt,otherlistedSource:meta.otherlistedSource,
    otherlistedTimestamp:meta.otherlistedTimestamp,otherlistedSha256:meta.otherlistedSha256,
    tradableSymbolCount:rows.length,txseListedFlagCount:listed.length,
    independentlyEvidencedSecondaryCount:evidencedSecondary.length,
    listingEvidenceCandidateCount:securities.length,
    tradedOnlyNotTXSEListed:rows.length-listed.length,classificationCounts:counts,
    verifiedCommonStocks:0,verifiedISINs:0,verifiedActiveTrading:0,
    historicalBarsFetched:0,distributionRightsApproved:false,
    note:'TXSEListed=Y is a listing flag, not proof of common shares, active trading, ISIN or history. A named official TXSE+SEC dual-listing notice can add a research-only candidate despite TXSEListed=N; no general N-to-listed promotion or production approval.'}};
}
