import {classifyEuropeFailure,providerAttempts} from './europe-failure-diagnosis.mjs';

// Correlate audit gaps with source failures. Evidence only: no inferred
// delistings, no synthetic no-trade days, no catalog or history mutations.
const IDENTITY=new Set(['UNRESOLVED_MARKET_SYMBOL','DIRECT_SYMBOL_NOT_FOUND','ISIN_SEARCH_UNRESOLVED','SYMBOL_IDENTITY_MISMATCH']);
const SESSION=new Set(['NO_NEW_BARS_IN_RANGE','PROVIDER_RETURNED_NO_BARS','OFFICIAL_SOURCE_NO_USABLE_BARS']);
const ACCESS=new Set(['AUTH_OR_ACCESS','RATE_LIMIT','NETWORK_TIMEOUT']);
const SOURCE=new Set(['NO_SUPPORTED_PROVIDER_FOR_MARKET','SOURCE_HTTP_404','SYMBOL_MAPPING_REJECTED']);

function workstream(category,auditReason,numericSwissValor) {
 if(numericSwissValor)return 'VERIFY_SIX_VALOR_TO_CURRENT_TICKER';
 if(IDENTITY.has(category))return 'VERIFY_OFFICIAL_ISIN_MIC_TICKER';
 if(SESSION.has(category))return 'VERIFY_LAST_OFFICIAL_TRADE';
 if(ACCESS.has(category))return 'PROVIDER_ACCESS_OR_RETRY';
 if(SOURCE.has(category))return 'APPROVE_COMPATIBLE_MARKET_SOURCE';
 if(auditReason==='NO_HISTORY_PARTITIONS'||auditReason==='CATALOG_INSTRUMENT_MISSING')return 'REPAIR_STORAGE_IDENTITY_OR_ARCHIVE';
 return 'INSPECT_PROVIDER_AND_AUDIT_EVIDENCE';
}
function priority(item) {
 const weights={VERIFY_SIX_VALOR_TO_CURRENT_TICKER:100,VERIFY_OFFICIAL_ISIN_MIC_TICKER:85,REPAIR_STORAGE_IDENTITY_OR_ARCHIVE:80,APPROVE_COMPATIBLE_MARKET_SOURCE:75,PROVIDER_ACCESS_OR_RETRY:65,VERIFY_LAST_OFFICIAL_TRADE:55,INSPECT_PROVIDER_AND_AUDIT_EVIDENCE:45};
 return Math.max(0,(weights[item.workstream]||40)-(item.knownDataUnavailable?10:0));
}

export function buildEuropeRecoveryQueue(updates,audits) {
 const failures=new Map();
 for(const update of updates||[])for(const market of update.markets||[])for(const f of market.failed||[]){
  failures.set(market.mic+'|'+f.isin,f);
 }
 const markets=[];
 for(const audit of audits||[])for(const market of audit.markets||[]){
  const instruments=[];
  for(const missing of market.missing||[]){
   const failure=failures.get(market.mic+'|'+missing.isin);
   const category=failure?classifyEuropeFailure(failure.error):'AUDIT_GAP_WITHOUT_SOURCE_FAILURE';
   const numericSwissValor=market.mic==='XSWX'&&/^\d{4,}$/.test(String(missing.symbol||''));
   const item={
    mic:market.mic,isin:missing.isin,symbol:missing.symbol||failure?.symbol||null,
    lastStoredDate:missing.lastDate||null,auditReason:missing.reason||null,
    knownDataUnavailable:missing.knownDataUnavailable||null,
    sourceFailureCategory:category,
    attempts:failure?providerAttempts(failure.error):[],
    numericSwissValor,
    workstream:workstream(category,missing.reason,numericSwissValor),
    // Retain original source error as evidence; never treat it as a trade-status assertion.
    error:failure?String(failure.error||'').slice(0,600):null
   };
   item.priority=priority(item);
   instruments.push(item);
  }
  instruments.sort((a,b)=>b.priority-a.priority||a.isin.localeCompare(b.isin));
  const workstreams={};
  for(const item of instruments)workstreams[item.workstream]=(workstreams[item.workstream]||0)+1;
  markets.push({mic:market.mic,missing:instruments.length,knownDataUnavailable:instruments.filter(x=>x.knownDataUnavailable).length,numericSwissValor:instruments.filter(x=>x.numericSwissValor).length,workstreams,instruments});
 }
 markets.sort((a,b)=>b.missing-a.missing);
 const totals={missing:markets.reduce((n,m)=>n+m.missing,0),numericSwissValor:markets.reduce((n,m)=>n+m.numericSwissValor,0),knownDataUnavailable:markets.reduce((n,m)=>n+m.knownDataUnavailable,0)};
 return {generatedAt:new Date().toISOString(),mode:'READ_ONLY_RECOVERY_QUEUE',warning:'Known DATA_UNAVAILABLE evidence does not prove no trading today. A failed provider does not prove a delisting. Verify ISIN, MIC and actual last trade before price writes.',totals,markets};
}
