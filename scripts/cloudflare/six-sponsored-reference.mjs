// Read-only current SIX Sponsored Foreign Shares admission reference.
// This is venue/symbol/ISIN/currency evidence, NOT a market-data licence.
export const SIX_SPONSORED_SOURCE='https://www.six-group.com/en/market-data/shares/sponsored-foreign-shares.html';
export function parseSixSponsoredAdmissions(html){
 const plain=String(html||'')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
  .replace(/<[^>]*>/g,' ')
  .replace(/&nbsp;|&#160;/gi,' ')
  .replace(/&amp;/gi,'&')
  .replace(/\s+/g,' ');
 const out=[],seen=new Set();
 const pattern=/\b([A-Z][A-Z0-9.\-]{0,14})\s+([A-Z]{2}[A-Z0-9]{10})\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ \-()]{2,70}?)\s+(CHF|USD|EUR|GBP|GBX)\s+(\d{2}\.\d{2}\.\d{4})\b/g;
 for(const match of plain.matchAll(pattern)){
  const [,ticker,isin,country,currency,firstTradingDate]=match;
  const key=isin+'|'+ticker+'|'+currency;
  if(seen.has(key))continue;
  seen.add(key);out.push({isin,ticker,currency,country:country.trim(),firstTradingDate});
 }
 return out;
}
export function compareSixSponsoredWithYahoo(yahooResults,officialRows){
 const index=new Map(),symbolOwners=new Map();
 for(const row of officialRows||[]){
  const key=row.isin+'|'+row.currency.toUpperCase();
  if(!index.has(key))index.set(key,[]);
  index.get(key).push(row);
  const symbolKey=row.ticker.toUpperCase()+'|'+row.currency.toUpperCase();
  if(!symbolOwners.has(symbolKey))symbolOwners.set(symbolKey,new Set());
  symbolOwners.get(symbolKey).add(row.isin);
 }
 return (yahooResults||[]).filter(x=>x?.mic==='XSWX').map(x=>{
  const base={mic:'XSWX',isin:x.isin,providerSymbol:x.providerSymbol,readOnly:true};
  if(x.status!=='YAHOO_VENUE_CURRENCY_OHLC_MATCH_OFFICIAL_ISIN_STILL_REQUIRED')return {...base,status:'YAHOO_INDEPENDENT_EVIDENCE_NOT_READY'};
  const candidates=index.get(x.isin+'|'+String(x.currency||'').toUpperCase())||[];
  if(!candidates.length)return {...base,status:'NOT_FOUND_IN_SIX_SPONSORED_SEGMENT'};
  const ticker=String(x.providerSymbol||'').replace(/\.SW$/i,'').toUpperCase();
  const exact=candidates.filter(y=>y.ticker===ticker);
  if(exact.length!==1)return {...base,status:exact.length?'AMBIGUOUS_SIX_OFFICIAL_SYMBOL':'SIX_OFFICIAL_SYMBOL_DIFFERS',officialSymbols:[...new Set(candidates.map(y=>y.ticker))]};
  const owners=symbolOwners.get(ticker+'|'+String(x.currency||'').toUpperCase());
  if(owners?.size>1)return {...base,status:'SIX_OFFICIAL_TICKER_SHARED_BY_MULTIPLE_ISINS',ownerCount:owners.size};
  return {...base,status:'OFFICIAL_SIX_SPONSORED_ISIN_TICKER_CURRENCY_AND_YAHOO_MATCH',officialSource:SIX_SPONSORED_SOURCE,officialFirstTradingDate:exact[0].firstTradingDate,requiresLicenceReview:true};
 });
}
