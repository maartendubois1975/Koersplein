// Evidence-based triage. A Yahoo 404 is a failed symbol lookup, not proof that
// an officially listed security has never traded.
export function providerAttempts(error) {
  const message=String(error||'');
  const prefix=/Alle providers faalden voor [^:]+:\s*/;
  const detail=prefix.test(message)?message.split(prefix).at(-1):message;
  return detail.split(/;\s+(?=[a-z][a-z0-9-]*:\s)/i)
    .map(part=>part.match(/^([a-z][a-z0-9-]*):\s*(.*)$/i))
    .filter(Boolean).map(m=>({provider:m[1],reason:m[2]}));
}

export function classifyEuropeFailure(error) {
  const m=String(error||'');
  if(/CATALOG_INSTRUMENT_MISSING|Instrument ontbreekt/i.test(m))return 'CATALOG_IDENTITY_MISSING';
  if(/401|403|unauthorized|forbidden|AUTH_OR_ACCESS/i.test(m))return 'AUTH_OR_ACCESS';
  if(/429|rate.limit|too many requests/i.test(m))return 'RATE_LIMIT';
  if(/timeout|timed out|AbortError|fetch failed|ECONN|ETIMEDOUT/i.test(m))return 'NETWORK_TIMEOUT';
  if(/Providersymbool wijkt af|Providerbeurs wijkt af|invalid symbol|invalid ticker|symbol not/i.test(m))return 'SYMBOL_IDENTITY_MISMATCH';
  const noRange=/Provider returned no usable bars in requested range/i.test(m);
  const noBars=/Provider returned no daily bars/i.test(m);
  const noIsin=/Geen Yahoo ISIN-resolutie/i.test(m);
  const direct404=/Yahoo HTTP 404/i.test(m);
  if(direct404&&noIsin)return 'UNRESOLVED_MARKET_SYMBOL';
  if(direct404)return 'DIRECT_SYMBOL_NOT_FOUND';
  if(noIsin)return 'ISIN_SEARCH_UNRESOLVED';
  if(noRange)return 'NO_NEW_BARS_IN_RANGE';
  if(noBars)return 'PROVIDER_RETURNED_NO_BARS';
  if(/404|not found/i.test(m))return 'SOURCE_HTTP_404';
  if(/422/i.test(m))return 'SYMBOL_MAPPING_REJECTED';
  return 'PROVIDER_OTHER';
}

const actions={
  UNRESOLVED_MARKET_SYMBOL:'Verify the official ISIN-to-exchange ticker mapping; do not guess another listing.',
  DIRECT_SYMBOL_NOT_FOUND:'Verify ticker and market suffix against official reference data.',
  ISIN_SEARCH_UNRESOLVED:'Seek authorized official reference data or a verified alternative identifier.',
  NO_NEW_BARS_IN_RANGE:'Verify last actual trade and source freshness; do not invent a daily OHLC bar.',
  PROVIDER_RETURNED_NO_BARS:'Check listing status and source coverage; distinguish inactive from unsupported.',
  SYMBOL_IDENTITY_MISMATCH:'Quarantine mismatched provider identity until independently verified.',
  AUTH_OR_ACCESS:'Check authorization and provider access; do not bypass protection.',
  RATE_LIMIT:'Retry with bounded backoff and provider rate controls.',
  NETWORK_TIMEOUT:'Retry after transient network failure with bounded backoff.',
  CATALOG_IDENTITY_MISSING:'Reconcile immutable catalog/storage identity before importing.',
  PROVIDER_OTHER:'Inspect individual provider errors and source-specific behavior.'
};

export function diagnoseEuropeReports(updates,audits=[]) {
  const auditByMic=new Map(audits.flatMap(a=>a.markets||[]).map(m=>[m.mic,m]));
  const byMarket=new Map();
  for(const update of updates)for(const market of update.markets||[]){
    if(!byMarket.has(market.mic))byMarket.set(market.mic,{mic:market.mic,failed:0,numericSymbolFailures:0,categories:{},providerFailures:{},examples:[],instruments:[]});
    const entry=byMarket.get(market.mic);
    for(const failure of market.failed||[]){
      const category=classifyEuropeFailure(failure.error);
      const attempts=providerAttempts(failure.error);
      const numericSymbol=/^\d{4,}$/.test(String(failure.symbol||''));
      entry.failed++;
      entry.numericSymbolFailures+=Number(numericSymbol);
      entry.categories[category]=(entry.categories[category]||0)+1;
      for(const attempt of attempts)entry.providerFailures[attempt.provider]=(entry.providerFailures[attempt.provider]||0)+1;
      const detail={isin:failure.isin,symbol:failure.symbol,category,numericSymbol,attempts,error:String(failure.error||'').slice(0,700)};
      entry.instruments.push(detail);
      if(entry.examples.length<5)entry.examples.push(detail);
    }
  }
  const markets=[...byMarket.values()].map(m=>{
    const audit=auditByMic.get(m.mic);
    const primary=Object.entries(m.categories).sort((a,b)=>b[1]-a[1])[0]?.[0]||null;
    return {...m,missingOpenClose:audit?.missingOpenClose??null,auditMissingReasons:audit?.missingReasons||{},primaryCause:primary,nextAction:actions[primary]||actions.PROVIDER_OTHER};
  }).sort((a,b)=>(b.missingOpenClose??b.failed)-(a.missingOpenClose??a.failed));
  return {generatedAt:new Date().toISOString(),mode:'READ_ONLY_EVIDENCE_TRIAGE',note:'Failed source requests are not proof of delisting or no-trade. Counts may overlap audit missing cases.',totals:{failed:markets.reduce((n,m)=>n+m.failed,0),numericSymbolFailures:markets.reduce((n,m)=>n+m.numericSymbolFailures,0)},markets};
}
