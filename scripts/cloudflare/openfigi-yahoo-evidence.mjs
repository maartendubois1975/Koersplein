// Independent read-only Yahoo market/currency/OHLC evidence for OpenFIGI candidates.
// Neither OpenFIGI nor Yahoo metadata establishes a CURRENT OFFICIAL ISIN listing.
// Never promote candidates to the production catalog or write price history.
import {isCompleteOhlcBar} from './europe-run-policy.mjs';

const SUFFIX={XSWX:'.SW',XLON:'.L'};
const VENUES={
 XSWX:new Set(['EBS','SWX','SIX','SIXSWISSEXCHANGE','SWISSEXCHANGE','SWISS','ZURICH']),
 XLON:new Set(['LSE','LON','LONDONSTOCKEXCHANGE'])
};
const normVenue=value=>String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
export function normalizeQuoteCurrency(value){
 const raw=String(value||'').trim();
 return raw==='GBp'||raw.toUpperCase()==='GBX'?'GBX':raw.toUpperCase();
}
export function selectOpenFigiYahooCandidates(report,{offset=0,limit=80}={}){
 if(report?.mode!=='READ_ONLY_NO_PRICE_WRITES'||!Array.isArray(report.items))throw Error('Expected read-only OpenFIGI reference artifact');
 if(!Number.isInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>100)throw Error('Invalid read-only verification page');
 const eligible=report.items.filter(x=>x.classification==='REFERENCE_CANDIDATE_REQUIRES_INDEPENDENT_VERIFICATION'&&x.candidates?.length===1&&SUFFIX[x.mic]);
 eligible.sort((a,b)=>(a.mic==='XSWX'?0:1)-(b.mic==='XSWX'?0:1)||a.isin.localeCompare(b.isin));
 return {totalEligible:eligible.length,offset,limit,items:eligible.slice(offset,offset+limit),ambiguousDeferred:report.items.filter(x=>x.classification==='AMBIGUOUS_MULTIPLE_TICKERS').length};
}
export function findOpenFigiSymbolCollisions(report){
 const owners=new Map();
 for(const item of report?.items||[])for(const candidate of item.candidates||[]){
  const symbol=String(candidate.providerSymbol||'').toUpperCase();
  if(!symbol)continue;
  if(!owners.has(symbol))owners.set(symbol,new Set());
  owners.get(symbol).add(item.isin);
 }
 return new Set([...owners].filter(([,isins])=>isins.size>1).map(([symbol])=>symbol));
}
export function evaluateYahooReference(item,chart,{asOf='2026-10-22',recentDays=45}={}){
 const base={mic:item.mic,isin:item.isin,catalogSymbol:item.catalogSymbol||null,currency:item.currency||null,providerSymbol:item.candidates?.[0]?.providerSymbol||null,readOnly:true};
 const candidate=item.candidates?.[0],suffix=SUFFIX[item.mic];
 if(item.classification!=='REFERENCE_CANDIDATE_REQUIRES_INDEPENDENT_VERIFICATION'||!candidate||item.candidates.length!==1||!suffix)return {...base,status:'NOT_UNIQUE_OFFICIAL_MIC_REFERENCE'};
 const symbol=String(candidate.providerSymbol||'').toUpperCase();
 if(!/^[A-Z0-9][A-Z0-9.\-]{0,19}\.(SW|L)$/.test(symbol)||symbol!==String(candidate.ticker||'').toUpperCase()+suffix)return {...base,status:'UNSAFE_REFERENCE_SYMBOL'};
 if(!item.currency)return {...base,status:'CATALOG_CURRENCY_UNKNOWN'};
 const meta=chart?.meta||{};
 if(String(meta.symbol||'').toUpperCase()!==symbol)return {...base,status:'YAHOO_SYMBOL_MISMATCH',observedSymbol:meta.symbol||null};
 const fields=[meta.exchangeName,meta.fullExchangeName].map(normVenue).filter(Boolean);
 if(!fields.length||!fields.some(x=>VENUES[item.mic].has(x)))return {...base,status:'YAHOO_VENUE_UNVERIFIED',observedExchange:meta.exchangeName||meta.fullExchangeName||null};
 if(!meta.currency)return {...base,status:'YAHOO_CURRENCY_UNKNOWN'};
 if(normalizeQuoteCurrency(item.currency)!==normalizeQuoteCurrency(meta.currency))return {...base,status:'YAHOO_CURRENCY_MISMATCH',observedCurrency:meta.currency};
 const end=new Date(asOf+'T00:00:00Z');
 if(Number.isNaN(end.getTime())||end.toISOString().slice(0,10)!==asOf||!Number.isInteger(recentDays)||recentDays<1||recentDays>120)throw Error('Invalid read-only Yahoo verification window');
 const min=new Date(end);min.setUTCDate(min.getUTCDate()-recentDays+1);
 const minDate=min.toISOString().slice(0,10);
 const bars=(chart?.bars||[]).filter(b=>b.date>=minDate&&b.date<=asOf);
 const complete=bars.filter(isCompleteOhlcBar);
 if(!complete.length)return {...base,status:'NO_RECENT_COMPLETE_YAHOO_OHLC',barsSeen:bars.length,windowStart:minDate,windowEnd:asOf};
 return {...base,status:'YAHOO_VENUE_CURRENCY_OHLC_MATCH_OFFICIAL_ISIN_STILL_REQUIRED',observedCurrency:meta.currency,observedExchange:meta.exchangeName||meta.fullExchangeName||null,latestCompleteDate:complete.map(x=>x.date).sort().at(-1),completeBars:complete.length,windowStart:minDate,windowEnd:asOf};
}
export async function fetchYahooReferenceChart(providerSymbol,{startDate,endDate,timeoutMs=15000}={}){
 if(!/^[A-Z0-9][A-Z0-9.\-]{0,19}\.(SW|L)$/.test(String(providerSymbol||'').toUpperCase()))throw Error('Unsafe read-only Yahoo symbol');
 const url=new URL('https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(providerSymbol));
 const period1=Math.floor(Date.parse(startDate+'T00:00:00Z')/1000),period2=Math.floor(Date.parse(endDate+'T23:59:59Z')/1000);
 if(!Number.isFinite(period1)||!Number.isFinite(period2)||period2<period1)throw Error('Invalid Yahoo research dates');
 url.searchParams.set('period1',String(period1));url.searchParams.set('period2',String(period2));url.searchParams.set('interval','1d');
 const response=await fetch(url,{signal:AbortSignal.timeout(timeoutMs),headers:{Accept:'application/json','User-Agent':'Koersplein-identity-research/1.0'}});
 if(!response.ok)throw Error('Yahoo read-only HTTP '+response.status);
 const data=await response.json(),result=data?.chart?.result?.[0];
 if(!result||data?.chart?.error)throw Error('Yahoo chart missing');
 const q=result.indicators?.quote?.[0]||{};
 const finite=v=>v===null||v===undefined||v===''?null:Number.isFinite(Number(v))?Number(v):null;
 const bars=(result.timestamp||[]).map((stamp,i)=>({date:new Date(stamp*1000).toISOString().slice(0,10),open:finite(q.open?.[i]),high:finite(q.high?.[i]),low:finite(q.low?.[i]),close:finite(q.close?.[i])}));
 return {meta:result.meta||{},bars};
}
