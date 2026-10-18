import {YahooChartProvider} from './yahoo-chart.mjs';

const SEARCH='https://query2.finance.yahoo.com/v1/finance/search';
export class YahooIsinProvider {
 id='yahoo-isin-resolver'; name='Yahoo Finance ISIN resolver + chart'; requiresApiKey=false;
 supports(i){return /^[A-Z]{2}[A-Z0-9]{10}$/.test(i?.officialIsin||i?.isin||'');}
 async fetchDaily(instrument,opts={}){
  const url=new URL(SEARCH);url.searchParams.set('q',instrument.officialIsin||instrument.isin);url.searchParams.set('quotesCount','10');url.searchParams.set('newsCount','0');
  const r=await fetch(url,{signal:opts.signal,headers:{Accept:'application/json','User-Agent':'Koersplein-history/1.0'}});
  if(!r.ok)throw Error(`Yahoo search HTTP ${r.status} voor ${instrument.isin}`);
  const p=await r.json(), suffix={XAMS:'.AS',XBRU:'.BR',XPAR:'.PA',ALXP:'.PA',XMLI:'.PA',XLIS:'.LS',ALXL:'.LS',ENXL:'.LS',XMIL:'.MI',MTAA:'.MI',EXGM:'.MI',XCSE:'.CO',XHEL:'.HE',XICE:'.IC',XATH:'.AT',XLON:'.L',XETR:'.DE',XSWX:'.SW',XOSL:'.OL',XOAS:'.OL',MERK:'.OL',XDUB:'.IR',XMSM:'.IR',XESM:'.IR',XATL:'.IR',XMAD:'.MC',XSTO:'.ST',XWAR:'.WA',XWBO:'.VI',XPRA:'.PR',XBUD:'.BD',XBSE:'.RO',XBUL:'.SO',FNSE:'.ST',SSME:'.ST'}[String(instrument.mic||'').toUpperCase()];
  const quotes=(p?.quotes||[]).filter(q=>q?.symbol&&(!suffix||String(q.symbol).toUpperCase().endsWith(suffix)));
  if(!quotes.length)throw Error(`Geen Yahoo ISIN-resolutie voor ${instrument.isin}`);
  let last;
  for(const q of quotes){
   try{
    const y=new YahooChartProvider();
    return await y.fetchDaily({...instrument,providerSymbol:q.symbol,allowProviderExchangeMismatch:['XSWX','XLUX'].includes(String(instrument.mic||'').toUpperCase())},opts);
   }catch(e){last=e}
  }
  throw last||Error(`Geen gevalideerde Yahoo ISIN-route voor ${instrument.isin}`);
 }
}
