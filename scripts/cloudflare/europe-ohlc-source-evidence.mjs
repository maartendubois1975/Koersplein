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
// Spread read-only probes across different instruments before revisiting
// another defective date for the same ISIN. London has thousands of defective
// dates but far fewer unique securities; date-sorted input otherwise repeatedly
// probes a few illiquid symbols and starves the rest of the catalogue.
function diversifyByIsin(items){
 const groups=new Map();
 for(const item of items){
  const key=item.isin;
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(item);
 }
 const ordered=[],buckets=[...groups.values()];
 for(let depth=0;ordered.length<items.length;depth++){
  for(const group of buckets)if(depth<group.length)ordered.push(group[depth]);
 }
 return ordered;
}

// Only investigate incomplete candles already identified by the authorized
// read-only audit. No symbol guessing, no automatic identity promotion.
function isRealIsoDay(day){
 if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day))return false;
 const date=new Date(day+'T00:00:00Z');
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===day;
}
export function selectIncompleteOhlcCandidates(queue,{limit=30,perMarket=18,rotation=0}={}){
 if(!Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(perMarket)||perMarket<1||perMarket>100||!Number.isSafeInteger(rotation)||rotation<0)throw Error('Invalid OHLC probe limits');
 const buckets=[];
 for(const market of queue?.markets||[]){
  const byKey=new Map(),latest=[],historical=[];
  // A defective latest candle can also appear in the 30-day history audit.
  // Merge its immutable stored snapshot rather than discarding that evidence.
  for(const [scope,entries] of [['LATEST_AUDIT_BAR',market.instruments||[]],['RECENT_STORED_HISTORY',market.recentOhlcDebt||[]]]){
   for(const item of entries){
    if(item.auditReason!=='INCOMPLETE_OR_INVALID_OHLC'||item.mic!==market.mic||!isRealIsoDay(item.lastStoredDate))continue;
    const key=item.mic+'|'+item.isin+'|'+item.lastStoredDate;
    const existing=byKey.get(key);
    if(existing){
     if(existing.storedOhlc&&item.storedOhlc){
      const fields=['open','high','low','close'];
      if(fields.some(k=>String(existing.storedOhlc[k]??'')!==String(item.storedOhlc[k]??'')))existing.storedEvidenceConflict=true;
     }else if(!existing.storedOhlc&&item.storedOhlc)existing.storedOhlc=item.storedOhlc;
     existing.ohlcDefects=[...new Set([...(existing.ohlcDefects||[]),...(item.ohlcDefects||[])])];
     continue;
    }
    const row={...item,evidenceScope:item.evidenceScope||scope};
    byKey.set(key,row);
    (scope==='RECENT_STORED_HISTORY'?historical:latest).push(row);
   }
  }
  // Rotate the two scopes independently BEFORE interleaving: rotating over
  // the entire date-heavy historical queue can otherwise land beyond the
  // small latest section and sample historical dates exclusively for months.
  // Within each scope prefer a new ISIN before another date for that ISIN.
  const both=latest.length>0&&historical.length>0;
  const rotateScope=(entries,stride)=>{
   const diverse=diversifyByIsin(entries);
   if(!diverse.length)return [];
   const start=((rotation%diverse.length)*stride)%diverse.length;
   return Array.from({length:diverse.length},(_,i)=>diverse[(start+i)%diverse.length]);
  };
  const rotatedLatest=rotateScope(latest,both?Math.ceil(perMarket/2):perMarket);
  const rotatedHistory=rotateScope(historical,both?Math.max(1,Math.floor(perMarket/2)):perMarket);
  const all=[],scopes=rotation%2===0?[rotatedLatest,rotatedHistory]:[rotatedHistory,rotatedLatest];
  for(let i=0;i<Math.max(rotatedLatest.length,rotatedHistory.length);i++){
   for(const scope of scopes)if(i<scope.length)all.push(scope[i]);
  }
  if(!all.length)continue;
  const diverse=diversifyByIsin(all),count=Math.min(perMarket,diverse.length);
  buckets.push({mic:market.mic,total:diverse.length,items:diverse.slice(0,count),used:0});
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
// Read-only diagnosis of provider bars for the exact requested date. Counts
// explain whether London failures come from absent dates, missing fields or
// contradictory price ranges; never infer replacement prices or trade status.
export function describeExactDateSourceBars(bars,date){
 const exact=(Array.isArray(bars)?bars:[]).filter(bar=>bar?.date===date);
 const defects={};let completeBars=0;const completeSignatures=new Set();
 const add=key=>{defects[key]=(defects[key]||0)+1;};
 for(const bar of exact){
  if(isCompleteOhlcSourceBar(bar)){
   completeBars++;
   completeSignatures.add(JSON.stringify(['open','high','low','close'].map(key=>bar[key])));
   continue;
  }
  const good=key=>typeof bar[key]==='number'&&Number.isFinite(bar[key])&&bar[key]>0;
  for(const key of ['open','high','low','close'])if(!good(key))add('INVALID_OR_MISSING_'+key.toUpperCase());
  if(good('high')&&good('open')&&bar.high<bar.open)add('HIGH_BELOW_OPEN');
  if(good('high')&&good('close')&&bar.high<bar.close)add('HIGH_BELOW_CLOSE');
  if(good('low')&&good('open')&&bar.low>bar.open)add('LOW_ABOVE_OPEN');
  if(good('low')&&good('close')&&bar.low>bar.close)add('LOW_ABOVE_CLOSE');
  if(good('high')&&good('low')&&bar.high<bar.low)add('HIGH_BELOW_LOW');
 }
 if(!exact.length)add('NO_EXACT_DATE_BAR');
 // Two individually valid candles can still disagree on the same date.
 // Such source evidence is ambiguous and must not become a correction candidate.
 return {exactDateBars:exact.length,completeBars,invalidBars:exact.length-completeBars,conflictingCompleteBars:completeSignatures.size>1,defects,readOnly:true};
}
// Yahoo's direct chart adapter and its ISIN search adapter ultimately read
// the SAME Yahoo chart backend. Their agreement is not independent evidence.
// Unknown or unattributed sources must never be promoted to verified identity.
export function sourceFeedFamily(providerId){
 if(providerId==='yahoo-chart'||providerId==='yahoo-isin-resolver')return 'yahoo-chart-feed';
 return typeof providerId==='string'&&/^[a-z0-9-]+$/.test(providerId)?providerId:'UNATTRIBUTED';
}
export function summarizeOhlcSourceBarDiagnostics(rows){
 const byMarket={},byProvider={},bySourceFamily={};let observations=0,invalidSourceBars=0,probesWithInvalidBars=0,correlatedProviderAttempts=0,conflictingSourceObservations=0,distinctFeedObservations=0,feedLevelInvalidBarsLowerBound=0;
 for(const row of rows||[]){
  if(!row||typeof row.mic!=='string')continue;
  const samples=Array.isArray(row.sourceBarObservations)?row.sourceBarObservations:[];
  if(!byMarket[row.mic])byMarket[row.mic]={probesWithInvalidBars:0,sourceObservations:0,invalidSourceBars:0,defects:{}};
  const m=byMarket[row.mic];let hasInvalid=false;
  const familiesInProbe=new Set(),maxInvalidPerFeed=new Map();
  for(const sample of samples){
   if(!sample?.readOnly||!Number.isSafeInteger(sample.invalidBars)||sample.invalidBars<0)continue;
   observations++;m.sourceObservations++;
   if(sample.conflictingCompleteBars===true){
    conflictingSourceObservations++;
    m.conflictingSourceObservations=(m.conflictingSourceObservations||0)+1;
   }
   invalidSourceBars+=sample.invalidBars;m.invalidSourceBars+=sample.invalidBars;
   // Provider-level evidence identifies which approved feed supplied an
   // inconsistent bar. Missing identity remains explicitly unattributed.
   const providerId=typeof sample.providerId==='string'&&/^[a-z0-9-]+$/.test(sample.providerId)?sample.providerId:'UNATTRIBUTED';
   const family=sourceFeedFamily(providerId);
   if(familiesInProbe.has(family))correlatedProviderAttempts++;
   else familiesInProbe.add(family);
   maxInvalidPerFeed.set(family,Math.max(maxInvalidPerFeed.get(family)||0,sample.invalidBars));
   if(!bySourceFamily[family])bySourceFamily[family]={sourceObservations:0,invalidSourceBars:0,defects:{}};
   if(!m.bySourceFamily)m.bySourceFamily={};
   if(!m.bySourceFamily[family])m.bySourceFamily[family]={sourceObservations:0,invalidSourceBars:0,defects:{}};
   if(!byProvider[providerId])byProvider[providerId]={sourceObservations:0,invalidSourceBars:0,defects:{}};
   if(!m.byProvider)m.byProvider={};
   if(!m.byProvider[providerId])m.byProvider[providerId]={sourceObservations:0,invalidSourceBars:0,defects:{}};
   for(const bucket of [byProvider[providerId],m.byProvider[providerId],bySourceFamily[family],m.bySourceFamily[family]]){
    bucket.sourceObservations++;
    bucket.invalidSourceBars+=sample.invalidBars;
   }
   if(sample.invalidBars)hasInvalid=true;
   for(const [key,value] of Object.entries(sample.defects||{})){
    if(!/^[A-Z_]+$/.test(key)||!Number.isSafeInteger(value)||value<0)continue;
    m.defects[key]=(m.defects[key]||0)+value;
    byProvider[providerId].defects[key]=(byProvider[providerId].defects[key]||0)+value;
    m.byProvider[providerId].defects[key]=(m.byProvider[providerId].defects[key]||0)+value;
    bySourceFamily[family].defects[key]=(bySourceFamily[family].defects[key]||0)+value;
    m.bySourceFamily[family].defects[key]=(m.bySourceFamily[family].defects[key]||0)+value;
   }
  }
  // A Yahoo chart attempt and Yahoo ISIN resolver attempt can be the SAME
  // underlying feed. Preserve raw attempt counts, but publish a conservative
  // per-probe/per-feed lower bound, never a fictitious independent source count.
  for(const maximum of maxInvalidPerFeed.values()){
   distinctFeedObservations++;m.distinctFeedObservations=(m.distinctFeedObservations||0)+1;
   feedLevelInvalidBarsLowerBound+=maximum;
   m.feedLevelInvalidBarsLowerBound=(m.feedLevelInvalidBarsLowerBound||0)+maximum;
  }
  if(hasInvalid){probesWithInvalidBars++;m.probesWithInvalidBars++;}
 }
 return {readOnly:true,observations,invalidSourceBars,probesWithInvalidBars,correlatedProviderAttempts,distinctFeedObservations,feedLevelInvalidBarsLowerBound,conflictingSourceObservations,byMarket,byProvider,bySourceFamily};
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
 if(item.auditReason!=='INCOMPLETE_OR_INVALID_OHLC'||!isRealIsoDay(item.lastStoredDate))return {...base,status:'NOT_AN_INCOMPLETE_STORED_CANDLE'};
 if(item.storedEvidenceConflict)return {...base,status:'CONFLICTING_STORED_OHLC_EVIDENCE'};
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
 // Opt-in only for the immutable read-only audit: a missing Yahoo OPEN or
 // CLOSE must be diagnosed, never silently discarded by the chart adapter.
 // validBars below still excludes any incomplete or inconsistent source bar.
 const range={startDate:item.lastStoredDate,endDate:item.lastStoredDate,includeIncompleteBars:true};
 const sourceBarObservations=[];
 try{
  const {provider,result}=await registry.fetchDaily(instrument,range,primary,{allowedProviderIds:allowed,timeoutMs,acceptResult:(r,attemptedProvider)=>{
    const observation=describeExactDateSourceBars(r?.bars,item.lastStoredDate);
    if(sourceBarObservations.length<6)sourceBarObservations.push({...observation,providerId:attemptedProvider?.id||null,sourceFeedFamily:sourceFeedFamily(attemptedProvider?.id)});
    if(!observation.exactDateBars)throw Error('Source has no exact-date daily bar');
    if(observation.conflictingCompleteBars)throw Error('Source exact-date OHLC has conflicting complete duplicate bars');
    if(!observation.completeBars)throw Error('Source exact-date OHLC incomplete or inconsistent');
    return true;
   }});
  const bar=validBars(result,range).find(b=>b.date===item.lastStoredDate&&isCompleteOhlcSourceBar(b));
  if(!bar)throw Error('Approved provider returned no complete internally consistent OHLC source bar');
  const normalizeCurrency=value=>String(value||'').trim()==='GBp'?'GBX':String(value||'').trim().toUpperCase();
  const expectedCurrency=normalizeCurrency(instrument.currency);
  const sourceCurrency=result.providerMeta?.currency||null;
  const actualCurrency=normalizeCurrency(sourceCurrency);
  const candidateBar={date:bar.date,open:bar.open,high:bar.high,low:bar.low,close:bar.close,volume:bar.volume??null};
  const evidence={...identity,sourceVsStored:compareStoredAndSourceOhlc(item.storedOhlc,candidateBar),provider:provider.id,sourceFeedFamily:sourceFeedFamily(provider.id),sourceCurrency,expectedCurrency:instrument.currency||null,candidateBar,sourceSymbol:result.providerMeta?.symbol||null,sourceExchange:result.providerMeta?.fullExchangeName||result.providerMeta?.exchangeName||null,sourceBarObservations,storagePolicy:'APPEND_ONLY_EXISTING_BAR_UNCHANGED'};
  if(!expectedCurrency||!actualCurrency)return {...evidence,status:'SOURCE_CURRENCY_UNVERIFIED'};
  if(expectedCurrency!==actualCurrency)return {...evidence,status:'SOURCE_CURRENCY_MISMATCH_REQUIRES_REVIEW'};
  return {...evidence,status:'COMPLETE_BAR_CANDIDATE_REQUIRES_CORRECTION_REVIEW',currencyVerified:true,barDate:bar.date};
 }catch(error){
  return {...identity,status:'NO_COMPLETE_APPROVED_SOURCE_BAR',failureCategory:classifyEuropeFailure(error.message),sourceBarObservations,error:String(error.message).slice(0,400)};
 }
}

// Explain whether a batch covers many instruments or repeatedly samples the
// same illiquid symbol on different dates. Evidence-only, no source promotion.
export function summarizeOhlcProbeCoverage(rows){
 const byMarket=new Map(),all=new Set();
 for(const row of rows||[]){
  if(!row||typeof row.mic!=='string'||typeof row.isin!=='string')continue;
  if(!byMarket.has(row.mic))byMarket.set(row.mic,{probes:0,uniqueInstruments:0,repeatedInstrumentDates:0,failuresByCategory:{},_seen:new Set()});
  const entry=byMarket.get(row.mic),key=row.mic+'|'+row.isin;
  entry.probes++;
  if(entry._seen.has(key))entry.repeatedInstrumentDates++;
  else {entry._seen.add(key);entry.uniqueInstruments++;}
  all.add(key);
  if(row.status==='NO_COMPLETE_APPROVED_SOURCE_BAR'){
   const category=row.failureCategory||'UNCLASSIFIED';
   entry.failuresByCategory[category]=(entry.failuresByCategory[category]||0)+1;
  }
 }
 const markets={};
 for(const [mic,{_seen,...entry}] of [...byMarket.entries()].sort((a,b)=>a[0].localeCompare(b[0])))markets[mic]=entry;
 return {readOnly:true,uniqueInstruments:all.size,probedDates:(rows||[]).length,repeatedInstrumentDates:Object.values(markets).reduce((n,x)=>n+x.repeatedInstrumentDates,0),byMarket:markets};
}
