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
  // Search ranking is not identity evidence: when Yahoo supplies an ISIN or
  // instrument type, a contradictory match must never reach the chart route.
  // Some valid Yahoo equity quotes omit ISIN/type, so absent metadata is not
  // treated as an independently verified match (MIC/symbol/currency still gate).
  const quotes=(Array.isArray(p?.quotes)?p.quotes:[]).filter(q=>{
   if(!q?.symbol||!String(q.symbol).toUpperCase().endsWith(suffix.toUpperCase()))return false;
   if(q.isin&&String(q.isin).toUpperCase()!==isin.toUpperCase())return false;
   if(q.quoteType&&String(q.quoteType).toUpperCase()!=='EQUITY')return false;
   return true;
  });
  if(!quotes.length)throw Error(`Geen Yahoo ISIN-resolutie voor ${isin} op ${mic}`);
  let last;
  for(const q of quotes){
   try{
    // Search ranking and a .SW suffix are not proof of the trading venue.
    // Apply the same strict chart MIC, symbol and currency gate to SIX as to
    // every other approved exchange; no resolver-specific venue bypass.
    return await chart.fetchDaily({...instrument,providerSymbol:q.symbol},opts);
   }catch(e){last=e}
  }
  throw last||Error(`Geen gevalideerde Yahoo ISIN-route voor ${isin}`);
 }
}
