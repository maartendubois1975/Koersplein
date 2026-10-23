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
  buckets.push({mic:market.mic,total:all.length,items:Array.from({length:count},(_,i)=>all[(start+i)%all.length]),used:0});
 }
 if(!buckets.length)return [];
 // First give every affected market one rotating slot, so small exchanges
 // remain visible. Allocate remaining slots by outstanding historical debt:
 // London's thousands of defective dates should not receive only two probes
 // when a run has dozens of available read-only source requests.
 const out=[],offset=rotation%buckets.length;
 const ordered=Array.from({length:buckets.length},(_,i)=>buckets[(offset+i)%buckets.length]);
 for(const bucket of ordered){
  if(out.length>=limit)break;
  out.push(bucket.items[bucket.used++]);
 }
 while(out.length<limit){
  let best=null,bestScore=-1;
  for(const bucket of ordered){
   if(bucket.used>=bucket.items.length)continue;
   const score=bucket.total/(bucket.used+1);
   if(score>bestScore){best=bucket;bestScore=score;}
  }
  if(!best)break;
  out.push(best.items[best.used++]);
 }
 return out;
}
// A replacement candidate must be a complete, internally consistent OHLC candle.
// validBars() only guarantees positive OPEN and CLOSE; it intentionally does
// not certify HIGH/LOW. Never label a partial source bar as repair-ready.
export function isCompleteOhlcSourceBar(bar){
 if(!bar)return false;
 const values=['open','high','low','close'].map(k=>bar[k]);
 if(values.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<=0))return false;
 const [open,high,low,close]=values;
 return high>=Math.max(open,close)&&low<=Math.min(open,close)&&high>=low;
}
// Evidence-only difference against the exact stored candle. Never substitute
// a provider value for an existing stored field or infer missing prices.
export function compareStoredAndSourceOhlc(stored,source){
 if(!stored||!isCompleteOhlcSourceBar(source))return null;
 const fields={};let maxRelativeDiffBps=0,comparable=0;
 for(const key of ['open','high','low','close']){
  const raw=stored[key];
  const value=raw===null||raw===undefined||raw===''?NaN:Number(raw);
  if(!Number.isFinite(value)||value<=0){fields[key]={stored:raw??null,source:source[key],absoluteDifference:null,relativeDifferenceBps:null};continue;}
  const absoluteDifference=Math.abs(value-source[key]);
  const relativeDifferenceBps=absoluteDifference/source[key]*10000;
  fields[key]={stored:value,source:source[key],absoluteDifference,relativeDifferenceBps};
  maxRelativeDiffBps=Math.max(maxRelativeDiffBps,relativeDifferenceBps);comparable++;
 }
 return {readOnly:true,comparableFields:comparable,maxRelativeDiffBps:comparable?maxRelativeDiffBps:null,fields};
}
// Magnitude is evidence for triage, not permission to round or overwrite.
export function classifyOhlcDifferenceMagnitude(comparison){
 const bps=comparison?.maxRelativeDiffBps;
 if(!Number.isFinite(bps)||comparison?.comparableFields!==4)return 'NOT_FULLY_COMPARABLE';
 if(bps<1)return 'UNDER_1_BASIS_POINT';
 if(bps<100)return 'FROM_1_TO_100_BASIS_POINTS';
 return 'AT_LEAST_100_BASIS_POINTS';
}
export async function probeIncompleteOhlcCandidate(item,{registry,sources,market,listings,timeoutMs=12000}){
 const base={mic:item.mic,isin:item.isin,symbol:item.symbol||null,date:item.lastStoredDate,ohlcDefects:item.ohlcDefects||[],evidenceScope:item.evidenceScope||'LATEST_AUDIT_BAR',storedOhlc:item.storedOhlc||null,readOnly:true};
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
  const {provider,result}=await registry.fetchDaily(instrument,range,primary,{allowedProviderIds:allowed,timeoutMs,acceptResult:r=>validBars(r,range).some(b=>b.date===item.lastStoredDate&&isCompleteOhlcSourceBar(b))});
  const bar=validBars(result,range).find(b=>b.date===item.lastStoredDate&&isCompleteOhlcSourceBar(b));
  if(!bar)throw Error('Approved provider returned no complete internally consistent OHLC source bar');
  const normalizeCurrency=value=>String(value||'').trim()==='GBp'?'GBX':String(value||'').trim().toUpperCase();
  const expectedCurrency=normalizeCurrency(instrument.currency);
  const sourceCurrency=result.providerMeta?.currency||null;
  const actualCurrency=normalizeCurrency(sourceCurrency);
  const candidateBar={date:bar.date,open:bar.open,high:bar.high,low:bar.low,close:bar.close,volume:bar.volume??null};
  const evidence={...identity,sourceVsStored:compareStoredAndSourceOhlc(item.storedOhlc,candidateBar),provider:provider.id,sourceCurrency,expectedCurrency:instrument.currency||null,candidateBar,sourceSymbol:result.providerMeta?.symbol||null,sourceExchange:result.providerMeta?.fullExchangeName||result.providerMeta?.exchangeName||null,storagePolicy:'APPEND_ONLY_EXISTING_BAR_UNCHANGED'};
  if(!expectedCurrency||!actualCurrency)return {...evidence,status:'SOURCE_CURRENCY_UNVERIFIED'};
  if(expectedCurrency!==actualCurrency)return {...evidence,status:'SOURCE_CURRENCY_MISMATCH_REQUIRES_REVIEW'};
  return {...evidence,status:'COMPLETE_BAR_CANDIDATE_REQUIRES_CORRECTION_REVIEW',currencyVerified:true,barDate:bar.date};
 }catch(error){
  return {...identity,status:'NO_COMPLETE_APPROVED_SOURCE_BAR',failureCategory:classifyEuropeFailure(error.message),error:String(error.message).slice(0,400)};
 }
}
