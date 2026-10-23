// Read-only identifier evidence. OpenFIGI's ISIN+MIC mapping is NOT proof
// of an active listing or a Yahoo price identity; never promote automatically.
const EXCHANGE_CODES={XSWX:new Set(['SE']),XLON:new Set(['LN','LI'])};
export function figiJob(item) {
 if(!EXCHANGE_CODES[item?.mic]||!/^[A-Z]{2}[A-Z0-9]{10}$/.test(item?.isin||''))throw Error('Unsupported MIC or invalid ISIN');
 return {idType:'ID_ISIN',idValue:item.isin,micCode:item.mic,includeUnlistedEquities:true};
}
export function classifyFigiEvidence(item,response) {
 const allowed=EXCHANGE_CODES[item?.mic];
 if(!allowed)throw Error('Unsupported market '+item?.mic);
 const rows=Array.isArray(response?.data)?response.data:[];
 const valid=rows.filter(r=>r?.marketSector==='Equity'&&allowed.has(String(r.exchCode||'').toUpperCase())&&/^[A-Z0-9][A-Z0-9.\-]{0,19}$/i.test(String(r.ticker||'')));
 const byTicker=new Map();
 for(const row of valid){
  const ticker=String(row.ticker).toUpperCase();
  if(!byTicker.has(ticker))byTicker.set(ticker,[]);
  byTicker.get(ticker).push({figi:row.figi,exchangeCode:row.exchCode,name:row.name,securityType:row.securityType});
 }
 const candidates=[...byTicker].map(([ticker,evidence])=>({ticker,providerSymbol:ticker+(item.mic==='XSWX'?'.SW':'.L'),evidence}));
 const classification=response?.error?'SOURCE_ERROR':response?.warning?'NO_MATCH':candidates.length===1?'REFERENCE_CANDIDATE_REQUIRES_INDEPENDENT_VERIFICATION':candidates.length>1?'AMBIGUOUS_MULTIPLE_TICKERS':'NO_VERIFIED_MARKET_MATCH';
 return {mic:item.mic,isin:item.isin,catalogSymbol:item.symbol||null,currency:item.currency||null,classification,candidates,sourceError:response?.error||response?.warning||null,returnedRows:rows.length};
}
