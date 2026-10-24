const PROVIDER_ID = 'yahoo-chart';
const API_ROOT = 'https://query1.finance.yahoo.com/v8/finance/chart';

const MARKET_RULES = {
  XAMS: { suffix: '.AS', exchanges: ['ams', 'aex', 'amsterdam'] },
  XBRU: { suffix: '.BR', exchanges: ['bru', 'brussels', 'brussel'] },
  XDUB: { suffix: '.IR', exchanges: ['ise', 'dublin', 'euronext dublin'] },
  XMSM: { suffix: '.IR', exchanges: ['ise', 'dublin', 'euronext dublin'] },
  XESM: { suffix: '.IR', exchanges: ['ise', 'dublin', 'euronext growth dublin'] },
  XATL: { suffix: '.IR', exchanges: ['ise', 'dublin', 'euronext access dublin'] },
  XPAR: { suffix: '.PA', exchanges: ['par', 'paris', 'euronext paris'] },
  ALXP: { suffix: '.PA', exchanges: ['par', 'paris', 'euronext growth paris'] },
  XMLI: { suffix: '.PA', exchanges: ['par', 'paris', 'euronext access paris'] },
  XMIL: { suffix: '.MI', exchanges: ['mil', 'milan', 'italy', 'borsa italiana', 'bts', 'yhd'] },
  MTAA: { suffix: '.MI', exchanges: ['mil', 'milan', 'italy', 'borsa italiana', 'bts', 'yhd'] },
  EXGM: { suffix: '.MI', exchanges: ['mil', 'milan', 'italy', 'borsa italiana', 'bts', 'yhd'] },
  XOSL: { suffix: '.OL', exchanges: ['osl', 'oslo', 'oslo bors', 'oslo børs'] },
  XOAS: { suffix: '.OL', exchanges: ['osl', 'oslo', 'oslo bors', 'oslo børs'] },
  MERK: { suffix: '.OL', exchanges: ['osl', 'oslo', 'oslo bors', 'oslo børs'] },
  XLIS: { suffix: '.LS', exchanges: ['lis', 'lisbon'] },
  ALXL: { suffix: '.LS', exchanges: ['lis', 'lisbon'] },
  ENXL: { suffix: '.LS', exchanges: ['lis', 'lisbon'] },
  XETR: { suffix: '.DE', exchanges: ['ger', 'xetra', 'frankfurt', 'deutsche boerse', 'deutsche börse'] },
  XSWX: { suffix: '.SW', exchanges: ['swx', 'swiss', 'six swiss exchange', 'zurich', 'ebs'] },
  XMAD: { suffix: '.MC', exchanges: ['mce', 'madrid', 'bolsa de madrid', 'bme'] },
  XSTO: { suffix: '.ST', exchanges: ['sto', 'stockholm', 'nasdaq stockholm'] },
  XCSE: { suffix: '.CO', exchanges: ['cph', 'copenhagen', 'nasdaq copenhagen'] },
  XHEL: { suffix: '.HE', exchanges: ['hel', 'helsinki', 'nasdaq helsinki'] },
  XICE: { suffix: '.IC', exchanges: ['ice', 'iceland', 'nasdaq iceland', 'reykjavik'] },
  XATH: { suffix: '.AT', exchanges: ['ath', 'athens', 'athex', 'athens stock exchange'] },
  XWAR: { suffix: '.WA', exchanges: ['wse', 'warsaw', 'warsaw stock exchange', 'gpw'] },
  XWBO: { suffix: '.VI', exchanges: ['vie', 'vienna', 'vienna stock exchange', 'wiener boerse', 'wiener börse'] },
  XPRA: { suffix: '.PR', exchanges: ['pra', 'prague', 'prague stock exchange', 'pse'] },
  XBUD: { suffix: '.BD', exchanges: ['bud', 'budapest', 'budapest stock exchange', 'bse'] },
  XBSE: { suffix: '.RO', exchanges: ['bvb', 'bucharest', 'bucharest stock exchange'] },
  XBUL: { suffix: '.SO', exchanges: ['bul', 'sofia', 'bulgarian stock exchange', 'bse sofia'] },
  XLON: { suffix: '.L', exchanges: ['lse', 'london', 'london stock exchange'] },
  FNSE: { suffix: '.ST', exchanges: ['sto', 'stockholm', 'first north sweden', 'nasdaq stockholm'] },
  SSME: { suffix: '.ST', exchanges: ['sto', 'stockholm', 'first north sweden', 'nasdaq stockholm'] }
};

const isoDate = (unixSeconds) => new Date(unixSeconds * 1000).toISOString().slice(0, 10);
const finiteOrNull = (value) => Number.isFinite(value) ? value : null;
const normalize = (value) => String(value || '').trim().toLowerCase();
// Yahoo labels UK pence as GBp; the LSE catalog uses GBX for the same unit.
// Never confuse either with GBP pounds (100x difference).
// Read-only historical diagnostics may opt in to null OPEN/CLOSE source rows.
// Default production import behavior remains unchanged; downstream OHLC gates
// still reject incomplete candles and never synthesize prices.
const priceCurrency = value => {const raw=String(value||'').trim();return raw==='GBp'||raw.toUpperCase()==='GBX'?'GBX':raw.toUpperCase();};
export class YahooChartProvider {
 id=PROVIDER_ID; name='Yahoo Finance chart feed'; requiresApiKey=false;
 marketRule(instrument){return MARKET_RULES[String(instrument.mic||instrument.market||'').toUpperCase()]||null;}
 supports(instrument){
  const rule=this.marketRule(instrument),explicit=instrument.providerSymbol||instrument.provider_symbol,ticker=instrument.ticker||instrument.symbol;
  if(!rule||!(explicit||ticker))return false;
  // An explicit catalog providerSymbol is not allowed to escape its approved
  // MIC's Yahoo venue suffix. A .L override on XSWX or .SW on XLON is a
  // different trading line even if its search ranking looks convincing.
  if(explicit&&!String(explicit).toUpperCase().endsWith(rule.suffix.toUpperCase()))return false;
  // SIX monthly trade data sometimes contains the numeric Swiss valor number,
  // not a Yahoo trading symbol. Never construct an unverified 123456.SW key.
  if(!explicit&&String(instrument.mic||instrument.market||'').toUpperCase()==='XSWX'&&/^\d{4,}$/.test(String(ticker)))return false;
  return true;
 }
 providerSymbolFor(instrument){if(!this.supports(instrument))return null;const explicit=instrument.providerSymbol||instrument.provider_symbol;if(explicit)return explicit;const rule=this.marketRule(instrument),ticker=instrument.ticker||instrument.symbol;return rule&&ticker?`${ticker}${rule.suffix}`:null;}
 async fetchDaily(instrument,{startDate,endDate,signal,includeIncompleteBars=false}={}){const providerSymbol=this.providerSymbolFor(instrument);if(!providerSymbol)throw new Error(`Geen gecontroleerde Yahoo-koppeling voor ${instrument.isin}`);const period1=Math.floor(new Date(`${startDate}T00:00:00Z`).getTime()/1000),period2=Math.floor(new Date(`${endDate}T23:59:59Z`).getTime()/1000);const url=new URL(`${API_ROOT}/${encodeURIComponent(providerSymbol)}`);url.searchParams.set('period1',String(period1));url.searchParams.set('period2',String(period2));url.searchParams.set('interval','1d');url.searchParams.set('events','div,splits');const response=await fetch(url,{signal,headers:{Accept:'application/json','User-Agent':'Koersplein-history/1.0'}});if(!response.ok)throw new Error(`Yahoo HTTP ${response.status} voor ${providerSymbol}`);const payload=await response.json(),result=payload?.chart?.result?.[0];if(!result||payload?.chart?.error)throw new Error(payload?.chart?.error?.description||'Yahoo-resultaat ontbreekt');this.validateIdentity({...instrument,providerSymbol},result.meta);const quote=result.indicators?.quote?.[0]||{},adjusted=result.indicators?.adjclose?.[0]?.adjclose||[];const bars=(result.timestamp||[]).map((timestamp,index)=>{let high=finiteOrNull(quote.high?.[index]),low=finiteOrNull(quote.low?.[index]);if(high!==null&&low!==null&&high<low&&includeIncompleteBars!==true){high=null;low=null;}return{date:isoDate(timestamp),open:finiteOrNull(quote.open?.[index]),high,low,close:finiteOrNull(quote.close?.[index]),adjustedClose:finiteOrNull(adjusted[index]),volume:Number.isSafeInteger(quote.volume?.[index])?quote.volume[index]:null};}).filter(bar=>includeIncompleteBars===true||(bar.open!==null&&bar.close!==null));return{bars,requestUrl:url.toString(),providerMeta:{exchangeName:result.meta.exchangeName,fullExchangeName:result.meta.fullExchangeName,currency:result.meta.currency,symbol:result.meta.symbol,timezone:result.meta.exchangeTimezoneName}};}
 validateIdentity(instrument,meta={}){
  const expectedSymbol=String(instrument.providerSymbol||'').toUpperCase();
  const venueRule=this.marketRule(instrument);
  if(!venueRule||!expectedSymbol.endsWith(venueRule.suffix.toUpperCase()))
   throw new Error(`Providersymbool wijkt af voor ${instrument.isin}: geen goedgekeurde MIC-suffix voor ${expectedSymbol}`);
  if(meta.symbol?.toUpperCase()!==expectedSymbol)throw new Error(`Providersymbool wijkt af voor ${instrument.isin}: verwacht ${expectedSymbol}, ontvangen ${meta.symbol||'onbekend'}`);
  const mic=String(instrument.mic||instrument.market||'').toUpperCase();
  // Currency is part of every approved listing identity, not just Swiss and
  // London symbols. A correct exchange suffix with a different quote currency
  // is a different trading line and must never be imported into this listing.
  // In London, GBX/GBp are pence while GBP means pounds; never mix units.
  if(instrument.currency&&priceCurrency(instrument.currency)!==priceCurrency(meta.currency))
   throw new Error(`Providervaluta wijkt af voor ${instrument.isin}: verwacht ${instrument.currency}, ontvangen ${meta.currency||'onbekend'}`);
  // Every approved venue, including Swiss ISIN-resolved fallback symbols,
  // must have independently consistent exchange metadata. A .SW suffix and
  // matching currency alone do not prove that the returned trading line
  // belongs to SIX; never bypass the venue gate for resolver candidates.
  const rule=this.marketRule(instrument);
  if(!rule)throw new Error(`Geen Yahoo-beursregel voor ${instrument.mic||instrument.market}`);
  const exchangeFields=[meta.exchangeName,meta.fullExchangeName].map(normalize).filter(Boolean);
  // Missing exchange metadata is not positive evidence of the approved MIC.
  // A correct ticker suffix alone cannot independently verify the venue.
  if(!exchangeFields.length)throw new Error(`Providerbeurs ontbreekt voor ${instrument.isin}: verwacht ${instrument.mic||instrument.market}`);
  // Never accept substring coincidences (e.g. FALSE contains LSE), or
  // contradictory exchangeName/fullExchangeName pairs where one looks right.
  // Exact aliases and their explicit descriptive extensions are accepted;
  // a prefix such as "NOT LSE" cannot masquerade as the LSE venue.
  const matchesVenue=field=>rule.exchanges.some(alias=>
   field===alias||[' stock exchange',' exchange',' market',' ab',' xetra'].some(extension=>field===alias+extension)
  );
  if(!exchangeFields.every(matchesVenue))
   throw new Error(`Providerbeurs wijkt af voor ${instrument.isin}: verwacht ${instrument.mic||instrument.market}, ontvangen ${meta.fullExchangeName||meta.exchangeName}`);
 }
}
