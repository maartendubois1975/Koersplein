// Conservative NYSE/Nasdaq security-type triage. Labels are hints, never proof of common equity.
// Nasdaq Trader "ETF=N" only means non-ETF; it does not imply ordinary shares.
export function classifyUSListing({symbol='',name='',etf='N',testIssue='N'}={}) {
  const s=String(symbol).trim().toUpperCase(), n=String(name).trim();
  if(!s||!n) return {type:'REVIEW',reason:'MISSING_IDENTITY'};
  if(!['Y','N'].includes(etf)||!['Y','N'].includes(testIssue)) return {type:'REVIEW',reason:'UNKNOWN_SOURCE_FLAG'};
  if(testIssue==='Y') return {type:'TEST',reason:'OFFICIAL_TEST_FLAG'};
  if(etf==='Y') return {type:'ETF',reason:'OFFICIAL_ETF_FLAG'};
  // Units may describe their embedded warrants, rights or preferred shares; classify the traded unit first.
  if(/\.U$/.test(s)||/\bunits?\b/i.test(n)) return {type:'UNIT',reason:'UNIT_DESCRIPTOR_OR_SUFFIX'};
  if(/\bpreferred\b|\bpreference shares?\b|\bpreference stock\b/i.test(n)||/\$[A-Z0-9]+$/.test(s)) return {type:'PREFERRED',reason:'PREFERRED_DESCRIPTOR_OR_SUFFIX'};
  if(/\bwarrants?\b/i.test(n)||/\.(?:W|WS)(?:[0-9]+)?$/.test(s)) return {type:'WARRANT',reason:'WARRANT_DESCRIPTOR_OR_SUFFIX'};
  if(/\brights?\b/i.test(n)||/\.R$/.test(s)) return {type:'RIGHT',reason:'RIGHT_DESCRIPTOR_OR_SUFFIX'};
  if(/\bamerican depositary\b|\bamerican depository\b|\bADRs?\b|\bADSs?\b|\bglobal depositary\b/i.test(n)) return {type:'ADR',reason:'DEPOSITARY_DESCRIPTOR'};
  if(/\b(?:senior|subordinated|convertible) notes?\b|\bdebentures?\b|\bbonds?\b|\bETNs?\b|\bnotes? due \d{4}\b/i.test(n)) return {type:'DEBT',reason:'DEBT_DESCRIPTOR'};
  if(/\b(?:closed[ -]?end|mutual|investment|income|opportunities) fund\b|\bfund\b|\binvestment trust\b/i.test(n)) return {type:'FUND_REVIEW',reason:'FUND_DESCRIPTOR'};
  // Trust/REIT beneficial-interest shares need independent share-class verification.
  if(/\bbeneficial\s+interest\b/i.test(n)) return {type:'BENEFICIAL_INTEREST_REVIEW',reason:'BENEFICIAL_INTEREST_CLASS_NOT_VERIFIED'};
  // Trust Common Stock can be a fund, royalty trust or REIT; require independent share-class evidence.
  if(/\btrust\b(?:\s*\([^)]*\))?\s+common\s+(?:stock|shares?)\b/i.test(n)) return {type:'TRUST_COMMON_REVIEW',reason:'TRUST_COMMON_CLASS_NOT_VERIFIED'};
  if(/\bclass [A-Z] capital stock\s*$/i.test(n)||/\bcommon (?:stock|shares?)\b|\bordinary shares?\b|\bclass [A-Z] shares?\b|\bshares? of common\b/i.test(n)) return {type:'COMMON_CANDIDATE',reason:'EQUITY_DESCRIPTOR_NOT_INDEPENDENTLY_VERIFIED'};
  return {type:'REVIEW',reason:'NO_UNAMBIGUOUS_EQUITY_DESCRIPTOR'};
}
// Explicitly quarantine non-common NYSE candidate types; descriptive hints never approve a share.
export function triageUSCatalogCandidate(classification) {
  const common=classification?.type==='COMMON_CANDIDATE';
  return {catalogStatus:common?'COMMON_CANDIDATE_NOT_VERIFIED':'QUARANTINE_SECURITY_TYPE',
    quarantineReason:common?null:'SECURITY_TYPE_NOT_VERIFIED'};
}
export function classifySummary(rows) {
  const counts={};
  for(const row of rows) counts[row.securityType]=(counts[row.securityType]||0)+1;
  return Object.fromEntries(Object.entries(counts).sort(([a],[b])=>a.localeCompare(b)));
}
