import {validBars} from './europe-run-policy.mjs';
import {classifyEuropeFailure} from './europe-failure-diagnosis.mjs';

// Parent catalogues contain legitimate submarket MICs (e.g. XPAR -> ALXP).
// Explicitly allow only known child boards; never treat an arbitrary MIC as
// the parent's exchange or bypass provider-level exchange/currency checks.
const CATALOG_CHILD_MICS={
 XPAR:['ALXP','XMLI','MLXP','TNLP','ENXP'],
 XLIS:['ALXL','ENXL'],
 XMIL:['MTAA','EXGM'],
 XOSL:['XOAS','MERK'],
 XDUB:['XMSM','XESM','XATL'],
 XSTO:['FNSE','SSME']
};
export function approvedCatalogListingMic(parentMic,listingMic){
 return listingMic===parentMic||(CATALOG_CHILD_MICS[parentMic]||[]).includes(listingMic);
}
// Only investigate incomplete candles already identified by the authorized
// read-only audit. No symbol guessing, no automatic identity promotion.
export function selectIncompleteOhlcCandidates(queue,{limit=30,perMarket=18,rotation=0}={}){
 if(!Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(perMarket)||perMarket<1||perMarket>100||!Number.isSafeInteger(rotation)||rotation<0)throw Error('Invalid OHLC probe limits');
 const buckets=[];
 for(const market of queue?.markets||[]){
  const seen=new Set(),all=[];
  // Include both invalid latest bars and older defective stored dates. Dedupe
  // the overlap so a single defective day never consumes two probe slots.
  for(const item of [...(market.instruments||[]),...(market.recentOhlcDebt||[])]){
   if(item.auditReason!=='INCOMPLETE_OR_INVALID_OHLC'||item.mic!==market.mic||!/^\d{4}-\d{2}-\d{2}$/.test(item.lastStoredDate||''))continue;
   const key=item.mic+'|'+item.isin+'|'+item.lastStoredDate;
   if(seen.has(key))continue;
   seen.add(key);all.push(item);
  }
  if(!all.length)continue;
  const start=((rotation%all.length)*perMarket)%all.length;
  const count=Math.min(perMarket,all.length);
  buckets.push(Array.from({length:count},(_,i)=>all[(start+i)%all.length]));
 }
 if(!buckets.length)return [];
 // Fair round-robin: the former market-by-market scan used the entire 30-item
 // budget on London/Switzerland and never examined the remaining exchanges.
 const out=[],offset=rotation%buckets.length;
 for(let pass=0;pass<perMarket&&out.length<limit;pass++){
  for(let i=0;i<buckets.length&&out.length<limit;i++){
   const bucket=buckets[(offset+i)%buckets.length];
   if(pass<bucket.length)out.push(bucket[pass]);
  }
 }
 return out;
}
export async function probeIncompleteOhlcCandidate(item,{registry,sources,market,listings,timeoutMs=12000}){
 const base={mic:item.mic,isin:item.isin,symbol:item.symbol||null,date:item.lastStoredDate,ohlcDefects:item.ohlcDefects||[],evidenceScope:item.evidenceScope||'LATEST_AUDIT_BAR',readOnly:true};
 if(item.auditReason!=='INCOMPLETE_OR_INVALID_OHLC'||!/^\d{4}-\d{2}-\d{2}$/.test(item.lastStoredDate||''))return {...base,status:'NOT_AN_INCOMPLETE_STORED_CANDLE'};
 if(!market||market.mic!==item.mic||sources?.status!=='APPROVED')return {...base,status:'NO_APPROVED_MARKET_ROUTE'};
 // The market's own catalogue is already scoped to the parent exchange.
 // Preserve the listing's actual MIC (Growth/Access boards differ from XPAR).
 const matching=(listings||[]).filter(x=>x.isin===item.isin);
 if(matching.length!==1)return {...base,status:matching.length?'AMBIGUOUS_CATALOG_ISIN_MIC':'NO_EXACT_CATALOG_ISIN_MIC'};
 const share=matching[0],listingMic=share.mic||market.mic;
 if(!approvedCatalogListingMic(market.mic,listingMic))return {...base,listingMic,status:'UNAPPROVED_CATALOG_SUBMARKET'};
 const identity={...base,listingMic};
 if(item.symbol&&share.symbol!==item.symbol&&share.ticker!==item.symbol)return {...identity,status:'CATALOG_SYMBOL_CHANGED_REQUIRES_REVIEW'};
 const primary=sources.historySources?.find(x=>x.role==='PRIMARY')?.provider;
 const allowed=[primary,...(sources.historySources||[]).filter(x=>['DISCOVERY_FALLBACK','FALLBACK'].includes(x.role)).map(x=>x.provider)].filter((id,index,array)=>id&&array.indexOf(id)===index&&registry.get(id));
 if(!primary||!registry.get(primary)||!allowed.length)return {...base,status:'NO_APPROVED_INSTALLED_PROVIDER'};
 const instrument={...share,mic:listingMic,market:listingMic,symbol:share.symbol||share.ticker,ticker:share.ticker||share.symbol,currency:share.currency||market.currency};
 const range={startDate:item.lastStoredDate,endDate:item.lastStoredDate};
 try{
  const {provider,result}=await registry.fetchDaily(instrument,range,primary,{allowedProviderIds:allowed,timeoutMs,acceptResult:r=>validBars(r,range).some(b=>b.date===item.lastStoredDate)});
  const bar=validBars(result,range).find(b=>b.date===item.lastStoredDate);
  const normalizeCurrency=value=>String(value||'').trim()==='GBp'?'GBX':String(value||'').trim().toUpperCase();
  const expectedCurrency=normalizeCurrency(instrument.currency);
  const sourceCurrency=result.providerMeta?.currency||null;
  const actualCurrency=normalizeCurrency(sourceCurrency);
  const candidateBar={date:bar.date,open:bar.open,high:bar.high,low:bar.low,close:bar.close,volume:bar.volume??null};
  const evidence={...identity,provider:provider.id,sourceCurrency,expectedCurrency:instrument.currency||null,candidateBar,sourceSymbol:result.providerMeta?.symbol||null,sourceExchange:result.providerMeta?.fullExchangeName||result.providerMeta?.exchangeName||null,storagePolicy:'APPEND_ONLY_EXISTING_BAR_UNCHANGED'};
  if(!expectedCurrency||!actualCurrency)return {...evidence,status:'SOURCE_CURRENCY_UNVERIFIED'};
  if(expectedCurrency!==actualCurrency)return {...evidence,status:'SOURCE_CURRENCY_MISMATCH_REQUIRES_REVIEW'};
  return {...evidence,status:'COMPLETE_BAR_CANDIDATE_REQUIRES_CORRECTION_REVIEW',currencyVerified:true,barDate:bar.date};
 }catch(error){
  return {...identity,status:'NO_COMPLETE_APPROVED_SOURCE_BAR',failureCategory:classifyEuropeFailure(error.message),error:String(error.message).slice(0,400)};
 }
}
