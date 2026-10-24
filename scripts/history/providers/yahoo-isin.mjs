import {YahooChartProvider} from './yahoo-chart.mjs';

const SEARCH='https://query2.finance.yahoo.com/v1/finance/search';
export class YahooIsinProvider {
 id='yahoo-isin-resolver'; name='Yahoo Finance ISIN resolver + chart'; requiresApiKey=false;
 supports(i){
  const isin=i?.officialIsin||i?.isin||'';
  // A Yahoo search match on ISIN does not establish the exchange. Never use
  // an arbitrary quote when the target MIC has no verified Yahoo suffix.
  return /^[A-Z]{2}[A-Z0-9]{10}$/.test(isin)&&Boolean(new YahooChartProvider().marketRule(i));
 }
 async fetchDaily(instrument,opts={}){
  const mic=String(instrument.mic||instrument.market||'').toUpperCase();
  const chart=new YahooChartProvider(),suffix=chart.marketRule(instrument)?.suffix;
  if(!suffix)throw Error('Geen gevalideerde Yahoo-beursregel voor '+mic);
  const isin=instrument.officialIsin||instrument.isin;
  if(!/^[A-Z]{2}[A-Z0-9]{10}$/.test(isin||''))throw Error('Geen geldig ISIN voor Yahoo-resolutie');
  const url=new URL(SEARCH);url.searchParams.set('q',isin);url.searchParams.set('quotesCount','10');url.searchParams.set('newsCount','0');
  const r=await fetch(url,{signal:opts.signal,headers:{Accept:'application/json','User-Agent':'Koersplein-history/1.0'}});
  if(!r.ok)throw Error(`Yahoo search HTTP ${r.status} voor ${isin}`);
  const p=await r.json();
  // Yahoo search ranking is not instrument identity. A suffix and venue
  // describe the trading line, not its ISIN. Only an explicit, matching
  // provider-reported ISIN AND EQUITY type may enter this fallback. Quotes
  // omitting either are unresolved, not implicitly confirmed. Officially
  // verified catalog providerSymbol overrides still use the direct chart route.
  const quotes=(Array.isArray(p?.quotes)?p.quotes:[]).filter(q=>
   typeof q?.symbol==='string'&&q.symbol.toUpperCase().endsWith(suffix.toUpperCase())&&
   typeof q.isin==='string'&&q.isin.trim().toUpperCase()===isin.toUpperCase()&&
   String(q.quoteType||'').toUpperCase()==='EQUITY'
  );
  const symbols=[...new Map(quotes.map(q=>[q.symbol.toUpperCase(),q.symbol])).values()];
  if(!symbols.length)throw Error(`Geen expliciet ISIN/EQUITY-bevestigde Yahoo-resolutie voor ${isin} op ${mic}`);
  // Multiple distinct Yahoo symbols for one ISIN on the same suffix are not
  // permission to pick the first search result. Quarantine for manual review.
  if(symbols.length!==1)throw Error(`Ambigue Yahoo ISIN-resolutie voor ${isin} op ${mic}: ${symbols.length} symbolen`);
  // Search metadata is only a first-party assertion, NOT independent official
  // ISIN verification. The chart still must pass symbol, MIC and currency.
  return chart.fetchDaily({...instrument,providerSymbol:symbols[0]},opts);
 }
}
