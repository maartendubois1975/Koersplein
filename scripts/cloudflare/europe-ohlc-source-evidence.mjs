import {validBars} from './europe-run-policy.mjs';
import {classifyEuropeFailure} from './europe-failure-diagnosis.mjs';

// Only investigate incomplete candles already identified by the authorized
// read-only audit. No symbol guessing, no automatic identity promotion.
export function selectIncompleteOhlcCandidates(queue,{limit=30,perMarket=18,rotation=0}={}){
 if(!Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(perMarket)||perMarket<1||perMarket>100||!Number.isSafeInteger(rotation)||rotation<0)throw Error('Invalid OHLC probe limits');
 const out=[];
 for(const market of queue?.markets||[]){
  const all=(market.instruments||[]).filter(x=>x.auditReason==='INCOMPLETE_OR_INVALID_OHLC'&&/^\d{4}-\d{2}-\d{2}$/.test(x.lastStoredDate||''));
  if(!all.length)continue;
  // Rotate the bounded read-only sample; otherwise every run probes the same first 30.
  const start=((rotation%all.length)*perMarket)%all.length;
  const count=Math.min(perMarket,all.length);
  for(let i=0;i<count;i++)out.push(all[(start+i)%all.length]);
  if(out.length>=limit)break;
 }
 return out.slice(0,limit);
}
export async function probeIncompleteOhlcCandidate(item,{registry,sources,market,listings,timeoutMs=12000}){
 const base={mic:item.mic,isin:item.isin,symbol:item.symbol||null,date:item.lastStoredDate,readOnly:true};
 if(item.auditReason!=='INCOMPLETE_OR_INVALID_OHLC'||!/^\d{4}-\d{2}-\d{2}$/.test(item.lastStoredDate||''))return {...base,status:'NOT_AN_INCOMPLETE_STORED_CANDLE'};
 if(!market||market.mic!==item.mic||sources?.status!=='APPROVED')return {...base,status:'NO_APPROVED_MARKET_ROUTE'};
 const matching=(listings||[]).filter(x=>x.isin===item.isin&&(x.mic||market.mic)===item.mic);
 if(matching.length!==1)return {...base,status:matching.length?'AMBIGUOUS_CATALOG_ISIN_MIC':'NO_EXACT_CATALOG_ISIN_MIC'};
 const share=matching[0];
 if(item.symbol&&share.symbol!==item.symbol&&share.ticker!==item.symbol)return {...base,status:'CATALOG_SYMBOL_CHANGED_REQUIRES_REVIEW'};
 const primary=sources.historySources?.find(x=>x.role==='PRIMARY')?.provider;
 const allowed=[primary,...(sources.historySources||[]).filter(x=>['DISCOVERY_FALLBACK','FALLBACK'].includes(x.role)).map(x=>x.provider)].filter((id,index,array)=>id&&array.indexOf(id)===index&&registry.get(id));
 if(!primary||!registry.get(primary)||!allowed.length)return {...base,status:'NO_APPROVED_INSTALLED_PROVIDER'};
 const instrument={...share,mic:item.mic,market:item.mic,symbol:share.symbol||share.ticker,ticker:share.ticker||share.symbol,currency:share.currency||market.currency};
 const range={startDate:item.lastStoredDate,endDate:item.lastStoredDate};
 try{
  const {provider,result}=await registry.fetchDaily(instrument,range,primary,{allowedProviderIds:allowed,timeoutMs,acceptResult:r=>validBars(r,range).some(b=>b.date===item.lastStoredDate)});
  const bar=validBars(result,range).find(b=>b.date===item.lastStoredDate);
  const normalizeCurrency=value=>String(value||'').trim()==='GBp'?'GBX':String(value||'').trim().toUpperCase();
  const expectedCurrency=normalizeCurrency(instrument.currency);
  const sourceCurrency=result.providerMeta?.currency||null;
  const actualCurrency=normalizeCurrency(sourceCurrency);
  const candidateBar={date:bar.date,open:bar.open,high:bar.high,low:bar.low,close:bar.close,volume:bar.volume??null};
  const evidence={...base,provider:provider.id,sourceCurrency,expectedCurrency:instrument.currency||null,candidateBar,sourceSymbol:result.providerMeta?.symbol||null,sourceExchange:result.providerMeta?.fullExchangeName||result.providerMeta?.exchangeName||null,storagePolicy:'APPEND_ONLY_EXISTING_BAR_UNCHANGED'};
  if(!expectedCurrency||!actualCurrency)return {...evidence,status:'SOURCE_CURRENCY_UNVERIFIED'};
  if(expectedCurrency!==actualCurrency)return {...evidence,status:'SOURCE_CURRENCY_MISMATCH_REQUIRES_REVIEW'};
  return {...evidence,status:'COMPLETE_BAR_CANDIDATE_REQUIRES_CORRECTION_REVIEW',currencyVerified:true,barDate:bar.date};
 }catch(error){
  return {...base,status:'NO_COMPLETE_APPROVED_SOURCE_BAR',failureCategory:classifyEuropeFailure(error.message),error:String(error.message).slice(0,400)};
 }
}
