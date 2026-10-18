// Research-only SEC issuer/CIK crosscheck. A ticker is not a verified share class,
// ISIN, active trade or historical listing. Never promote catalog eligibility here.
const SEC_EXCHANGE={XNYS:'NYSE',XNAS:'Nasdaq'};
const CIK=/^[1-9]\d{0,9}$/;
// A real, operator-controlled contact must be supplied via the Actions secret.
// This is a syntax preflight, not proof that an address is owned or SEC access approved.
export function hasDeclaredSecContact(userAgent) {
  return typeof userAgent==='string' && userAgent.length<=250 &&
    /^Koersplein-USA-Research\/1\.0\s+\([^\s()@]+@[^\s()@]+\.[A-Za-z]{2,}\)$/.test(userAgent.trim());
}
export function crosscheckSecIssuer(catalog, sec, mic, provenance={}) {
  if(!SEC_EXCHANGE[mic])throw Error('SEC_UNSUPPORTED_MIC');
  if(catalog?.exchange!==mic||!Array.isArray(catalog.securities)||!catalog.securities.length)
    throw Error('SEC_INVALID_CATALOG');
  if(!sec||JSON.stringify(sec.fields)!==JSON.stringify(['cik','name','ticker','exchange'])||!Array.isArray(sec.data)||sec.data.length<1)
    throw Error('SEC_INVALID_OFFICIAL_SCHEMA');
  const byTicker=new Map();
  for(const row of sec.data){
    if(!Array.isArray(row)||row.length!==4||!CIK.test(String(row[0]))||typeof row[1]!=='string'||!row[1].trim()||typeof row[2]!=='string'||!row[2].trim()||typeof row[3]!=='string'||!row[3].trim())
      throw Error('SEC_INVALID_ROW');
    const key=row[2];
    const existing=byTicker.get(key)||[];
    existing.push({cik:String(row[0]).padStart(10,'0'),name:row[1],ticker:key,exchange:row[3]});
    byTicker.set(key,existing);
  }
  const seen=new Set();
  const records=catalog.securities.map(s=>{
    if(!s||typeof s.symbol!=='string'||!s.symbol||seen.has(s.symbol))throw Error('SEC_DUPLICATE_OR_INVALID_CATALOG_SYMBOL');
    seen.add(s.symbol);
    const base={mic,symbol:s.symbol,catalogStatus:s.catalogStatus,securityType:s.securityType,
      secTicker:null,secExchange:null,secIssuerName:null,secIssuerCIKCandidate:null,
      isinVerified:false,shareClassVerified:false,activeTradingVerified:false,eligibleForTraining:false};
    if(s.catalogStatus!=='COMMON_CANDIDATE_NOT_VERIFIED'||s.securityType!=='COMMON_CANDIDATE')
      return {...base,status:'EXCLUDED_OR_QUARANTINED'};
    const matches=byTicker.get(s.symbol)||[];
    if(!matches.length)return {...base,status:'SEC_TICKER_NOT_FOUND'};
    if(matches.length!==1)return {...base,status:'SEC_TICKER_AMBIGUOUS'};
    const hit=matches[0];
    const fields={secTicker:hit.ticker,secExchange:hit.exchange,secIssuerName:hit.name};
    if(hit.exchange!==SEC_EXCHANGE[mic])return {...base,...fields,status:'SEC_EXCHANGE_MISMATCH_REVIEW'};
    if(s.issuerCIK&&s.issuerCIK!==hit.cik)throw Error('SEC_EXISTING_CIK_CONFLICT:'+s.symbol);
    return {...base,...fields,secIssuerCIKCandidate:hit.cik,status:'SEC_EXACT_TICKER_EXCHANGE_CIK_CANDIDATE'};
  });
  const statusCounts=Object.fromEntries([...new Set(records.map(x=>x.status))].sort().map(k=>[k,records.filter(x=>x.status===k).length]));
  return {mic,source:'https://www.sec.gov/files/company_tickers_exchange.json',...provenance,
    status:'SEC_RESEARCH_CROSSCHECK_ONLY_NOT_APPROVED',statusCounts,records,
    verifiedCommonStocks:0,verifiedISINs:0,verifiedActiveTrading:0,usableForTraining:0,
    note:'SEC exchange-ticker dataset is issuer/CIK crosscheck, not authoritative share-class/ISIN/active-trading or TXSE dual-listing evidence. Exact ticker+exchange yields a research candidate only; unmatched, mismatched and ambiguous entries remain unverified.'};
}

 // A blocked official SEC endpoint is explicit missing evidence, never an issuer match.
export function secUnavailableEvidence(catalog,mic,reason){
  if(!SEC_EXCHANGE[mic]||catalog?.exchange!==mic||!Array.isArray(catalog.securities)||!catalog.securities.length)
    throw Error('SEC_INVALID_CATALOG');
  if(reason!==403&&reason!=='CONTACT_NOT_CONFIGURED')throw Error('SEC_UNEXPECTED_BLOCK_REASON');
  const undeclared=reason==='CONTACT_NOT_CONFIGURED';
  return {mic,source:'https://www.sec.gov/files/company_tickers_exchange.json',
    status:'SEC_OFFICIAL_SOURCE_UNAVAILABLE',
    blockedReason:undeclared?'SEC_USER_AGENT_CONTACT_NOT_CONFIGURED':'SEC_HTTP_403_GITHUB_RUNNER',
    httpStatus:undeclared?null:403,
    catalogSourceSha256:catalog.sourceSha256??null,candidateCount:catalog.securities.length,
    verifiedCommonStocks:0,verifiedISINs:0,verifiedActiveTrading:0,usableForTraining:0,
    note:undeclared?'No SEC request attempted: an operator-controlled contact must be configured before automated access. No issuer/CIK comparison or approval.':'SEC denied this GitHub Actions runner. No SEC issuer/CIK comparison was performed. All catalog candidates remain unverified; no source gate or approval.'};
}
