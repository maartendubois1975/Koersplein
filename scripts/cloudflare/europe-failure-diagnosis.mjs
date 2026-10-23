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
  // Never scan the instrument ISIN in "Alle providers faalden voor ...":
  // valid ISINs routinely contain 401/403/404/429, which are not HTTP codes.
  const raw=String(error||'');
  const attempts=providerAttempts(raw);
  const m=attempts.length?attempts.map(x=>x.reason).join('; '):raw.replace(/^Alle providers faalden voor [^:]+:\s*/, '');
  const unsupported=/Geen gecontroleerde Yahoo-koppeling|Geen Yahoo-beursregel/i;
  if(/Geen toegestane provider beschikbaar/i.test(m)||(attempts.length?attempts.every(x=>unsupported.test(x.reason)):unsupported.test(m)))return 'NO_SUPPORTED_PROVIDER_FOR_MARKET';
  if(/CATALOG_INSTRUMENT_MISSING|Instrument ontbreekt/i.test(m))return 'CATALOG_IDENTITY_MISSING';
  if(/\bHTTP\s*(?:401|403)\b|\b(?:status|code)\s*[:=]?\s*(?:401|403)\b|\bunauthori[sz]ed\b|\bforbidden\b|\bAUTH_OR_ACCESS\b/i.test(m))return 'AUTH_OR_ACCESS';
  if(/\bHTTP\s*429\b|\brate.limit\b|too many requests/i.test(m))return 'RATE_LIMIT';
  if(/timeout|timed out|AbortError|fetch failed|ECONN|ETIMEDOUT/i.test(m))return 'NETWORK_TIMEOUT';
  if(/Providersymbool wijkt af|Providerbeurs wijkt af|invalid symbol|invalid ticker|symbol not/i.test(m))return 'SYMBOL_IDENTITY_MISMATCH';
  // Source evidence must distinguish a missing trading-date bar from a bar
  // that exists but violates OHLC completeness. Both remain read-only and
  // neither proves delisting or authorizes an overwrite.
  if(/Source exact-date OHLC mixes complete and invalid duplicate bars/i.test(m))return 'SOURCE_EXACT_DATE_MIXED_BARS';
  if(/Source duplicate-date OHLC conflict/i.test(m))return 'SOURCE_DUPLICATE_DATE_OHLC_CONFLICT';
  if(/Source exact-date OHLC incomplete or inconsistent/i.test(m))return 'SOURCE_EXACT_DATE_OHLC_INVALID';
  if(/Source has no exact-date daily bar/i.test(m))return 'SOURCE_EXACT_DATE_NO_BAR';
  const noRange=/Provider returned no usable bars in requested range/i.test(m);
  const noBars=/Provider returned no daily bars/i.test(m);
  const noIsin=/Geen Yahoo ISIN-resolutie/i.test(m);
  const direct404=/Yahoo HTTP 404/i.test(m);
  if(direct404&&noIsin)return 'UNRESOLVED_MARKET_SYMBOL';
  if(direct404)return 'DIRECT_SYMBOL_NOT_FOUND';
  if(noIsin)return 'ISIN_SEARCH_UNRESOLVED';
  if(noRange)return 'NO_NEW_BARS_IN_RANGE';
  if(noBars)return 'PROVIDER_RETURNED_NO_BARS';
  if(/Geen Nasdaq Baltic koershistorie/i.test(m))return 'OFFICIAL_SOURCE_NO_USABLE_BARS';
  if(/\bHTTP\s*404\b|\bnot found\b/i.test(m))return 'SOURCE_HTTP_404';
  if(/\bHTTP\s*422\b/i.test(m))return 'SYMBOL_MAPPING_REJECTED';
  return 'PROVIDER_OTHER';
}

const actions={
  NO_SUPPORTED_PROVIDER_FOR_MARKET:'Market has no approved compatible history provider; route to official market data rather than retrying unsupported Yahoo symbols.',
  UNRESOLVED_MARKET_SYMBOL:'Verify the official ISIN-to-exchange ticker mapping; do not guess another listing.',
  DIRECT_SYMBOL_NOT_FOUND:'Verify ticker and market suffix against official reference data.',
  ISIN_SEARCH_UNRESOLVED:'Seek authorized official reference data or a verified alternative identifier.',
  NO_NEW_BARS_IN_RANGE:'Verify last actual trade and source freshness; do not invent a daily OHLC bar.',
  SOURCE_EXACT_DATE_OHLC_INVALID:'The source returned the requested date but incomplete or inconsistent OHLC; seek independently validated data, never synthesize high/low.',
  SOURCE_EXACT_DATE_MIXED_BARS:'The source returned both complete and invalid candles for the same date; quarantine that provider attempt and seek independently validated evidence.',
  SOURCE_DUPLICATE_DATE_OHLC_CONFLICT:'A provider returned conflicting same-day OHLC values; quarantine that date, retain safe dates and seek independently verified evidence.',
  SOURCE_EXACT_DATE_NO_BAR:'The approved source has other bars but none for the exact date; verify trading activity before calling this a missing price.',
  PROVIDER_RETURNED_NO_BARS:'Check listing status and source coverage; distinguish inactive from unsupported.',
  OFFICIAL_SOURCE_NO_USABLE_BARS:'Official endpoint returned no validated bars for this range; check last actual trade and archive coverage without inventing prices.',
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
