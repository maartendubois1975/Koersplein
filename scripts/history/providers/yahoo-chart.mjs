const PROVIDER_ID = 'yahoo-chart';
const API_ROOT = 'https://query1.finance.yahoo.com/v8/finance/chart';

const MARKET_RULES = {
  XAMS: { suffix: '.AS', exchanges: ['ams', 'aex', 'amsterdam'] },
  XBRU: { suffix: '.BR', exchanges: ['bru', 'brussels', 'brussel'] },
  XPAR: { suffix: '.PA', exchanges: ['par', 'paris', 'euronext paris'] },
  ALXP: { suffix: '.PA', exchanges: ['par', 'paris', 'euronext growth paris'] },
  XMLI: { suffix: '.PA', exchanges: ['par', 'paris', 'euronext access paris'] },
  XMIL: { suffix: '.MI', exchanges: ['mil', 'milan', 'italy', 'borsa italiana', 'bts', 'yhd'] },
  MTAA: { suffix: '.MI', exchanges: ['mil', 'milan', 'italy', 'borsa italiana', 'bts', 'yhd'] },
  EXGM: { suffix: '.MI', exchanges: ['mil', 'milan', 'italy', 'borsa italiana', 'bts', 'yhd'] }
};

const isoDate = (unixSeconds) => new Date(unixSeconds * 1000).toISOString().slice(0, 10);
const finiteOrNull = (value) => Number.isFinite(value) ? value : null;
const normalize = (value) => String(value || '').trim().toLowerCase();
export class YahooChartProvider {
 id=PROVIDER_ID; name='Yahoo Finance chart feed'; requiresApiKey=false;
 marketRule(instrument){return MARKET_RULES[String(instrument.mic||instrument.market||'').toUpperCase()]||null;}
 supports(instrument){return Boolean(this.marketRule(instrument)&&(instrument.providerSymbol||instrument.provider_symbol||instrument.ticker||instrument.symbol));}
 providerSymbolFor(instrument){const explicit=instrument.providerSymbol||instrument.provider_symbol;if(explicit)return explicit;const rule=this.marketRule(instrument),ticker=instrument.ticker||instrument.symbol;return rule&&ticker?`${ticker}${rule.suffix}`:null;}
 async fetchDaily(instrument,{startDate,endDate,signal}={}){const providerSymbol=this.providerSymbolFor(instrument);if(!providerSymbol)throw new Error(`Geen gecontroleerde Yahoo-koppeling voor ${instrument.isin}`);const period1=Math.floor(new Date(`${startDate}T00:00:00Z`).getTime()/1000),period2=Math.floor(new Date(`${endDate}T23:59:59Z`).getTime()/1000);const url=new URL(`${API_ROOT}/${encodeURIComponent(providerSymbol)}`);url.searchParams.set('period1',String(period1));url.searchParams.set('period2',String(period2));url.searchParams.set('interval','1d');url.searchParams.set('events','div,splits');const response=await fetch(url,{signal,headers:{Accept:'application/json','User-Agent':'Koersplein-history/1.0'}});if(!response.ok)throw new Error(`Yahoo HTTP ${response.status} voor ${providerSymbol}`);const payload=await response.json(),result=payload?.chart?.result?.[0];if(!result||payload?.chart?.error)throw new Error(payload?.chart?.error?.description||'Yahoo-resultaat ontbreekt');this.validateIdentity({...instrument,providerSymbol},result.meta);const quote=result.indicators?.quote?.[0]||{},adjusted=result.indicators?.adjclose?.[0]?.adjclose||[];const bars=(result.timestamp||[]).map((timestamp,index)=>{let high=finiteOrNull(quote.high?.[index]),low=finiteOrNull(quote.low?.[index]);if(high!==null&&low!==null&&high<low){high=null;low=null;}return{date:isoDate(timestamp),open:finiteOrNull(quote.open?.[index]),high,low,close:finiteOrNull(quote.close?.[index]),adjustedClose:finiteOrNull(adjusted[index]),volume:Number.isSafeInteger(quote.volume?.[index])?quote.volume[index]:null};}).filter(bar=>bar.close!==null);return{bars,requestUrl:url.toString(),providerMeta:{exchangeName:result.meta.exchangeName,fullExchangeName:result.meta.fullExchangeName,currency:result.meta.currency,symbol:result.meta.symbol,timezone:result.meta.exchangeTimezoneName}};}
 validateIdentity(instrument,meta={}){const expectedSymbol=String(instrument.providerSymbol||'').toUpperCase();if(meta.symbol?.toUpperCase()!==expectedSymbol)throw new Error(`Providersymbool wijkt af voor ${instrument.isin}: verwacht ${expectedSymbol}, ontvangen ${meta.symbol||'onbekend'}`);if(instrument.allowProviderExchangeMismatch)return;const rule=this.marketRule(instrument);if(!rule)throw new Error(`Geen Yahoo-beursregel voor ${instrument.mic||instrument.market}`);const exchangeFields=[meta.exchangeName,meta.fullExchangeName].map(normalize).filter(Boolean);if(exchangeFields.length&&!exchangeFields.some(field=>rule.exchanges.some(expected=>field.includes(expected))))throw new Error(`Providerbeurs wijkt af voor ${instrument.isin}: verwacht ${instrument.mic||instrument.market}, ontvangen ${meta.fullExchangeName||meta.exchangeName}`);}
}
