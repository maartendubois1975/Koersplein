// Strictly read-only, same-cutoff Europe daily audit comparison.
// A missing->nonmissing transition is NOT proof of a new price write.
import { readFile } from 'node:fs/promises';
import {BUDAPEST_CALENDAR_URL,isOfficialBudapestClosedDate} from '../history/providers/budapest-holiday.mjs';
import { pathToFileURL } from 'node:url';
import {isCompleteOhlcBar,isVerifiedNoTradeGap} from './europe-run-policy.mjs';
function check(ok,why){if(!ok)throw new Error('UNVERIFIED_EUROPE_RUN: '+why);}
const natural=x=>Number.isSafeInteger(x)&&x>=0;
const id=(mic,isin)=>mic+'\u0000'+isin;
const OFFICIAL_NO_TRADE_SOURCES=Object.freeze({
  'euronext-live':{host:'live.euronext.com',prefix:'/en/ajax/getHistoricalPricePopup/',
    mics:new Set(['XAMS','XBRU','XPAR','ALXP','XMLI','XMIL','MTAA','EXGM','XOSL','XOAS','MERK','XLIS','ALXL','ENXL','XDUB','XMSM','XESM','XATL'])},
  'nasdaq-baltic-official':{host:'nasdaqbaltic.com',prefix:'/statistics/en/statistics/stats_json',
    mics:new Set(['XTAL','XRIS','XLIT'])},
  'bse-budapest-calendar':{host:'bse.hu',prefix:'/newkibdata/129344942/',mics:new Set(['XBUD'])},
  'bse-sofia-official':{host:'www.bse-sofia.bg',prefix:'/en/',
    mics:new Set(['XBUL'])},
  'zse-price-list':{host:'rest.zse.hr',prefix:'/web/',
    mics:new Set(['XZAG'])},
  'mse-official-price-list':{host:'cdn.borzamalta.com.mt',prefix:'/download/statistics/Price_List/Price%20List.pdf',
    mics:new Set(['XMAL'])}
});
// The catalog groups official Euronext subvenues under parent markets.
// An official XMLI no-trade observation belongs to the XPAR catalog, not to
// an invented XPAR listing. Keep both identities and bind the source URL to
// the exact official venue/ISIN, never accept an arbitrary cross-MIC claim.
const EURONEXT_CATALOG_MIC_GROUPS=Object.freeze({
  XPAR:new Set(['XPAR','XMLI','ALXP']),
  XMIL:new Set(['XMIL','MTAA','EXGM']),
  XOSL:new Set(['XOSL','MERK','XOAS']),
  XLIS:new Set(['XLIS','ALXL','ENXL']),
  XDUB:new Set(['XDUB','XMSM','XESM','XATL']),
  XBRU:new Set(['XBRU']),
  XAMS:new Set(['XAMS'])
});
function verifyOfficialNoTrade(item,mic,cutoff,label){
  check(item.status==='NO_TRADES'&&item.date===cutoff&&typeof item.mic==='string'&&item.isin,
    label+'/'+mic+': no-trade identity/session provenance incomplete');
  const route=OFFICIAL_NO_TRADE_SOURCES[item.provider];
  const approvedVenue=item.provider==='euronext-live'?
    EURONEXT_CATALOG_MIC_GROUPS[mic]?.has(item.mic):item.mic===mic;
  check(approvedVenue&&route?.mics.has(item.mic),
    label+'/'+mic+': no-trade provider/venue not approved for catalog MIC');
  let url;
  try{url=new URL(item.sourceUrl);}catch{}
  check(url?.protocol==='https:'&&url.hostname===route.host&&!url.username&&!url.password&&
    !url.port&&url.pathname.startsWith(route.prefix),
    label+'/'+mic+': no-trade source URL not official');
  if(item.provider==='euronext-live'){
    const providerMic=item.mic==='XDUB'?'XMSM':item.mic;
    check(url.pathname===route.prefix+encodeURIComponent(item.isin+'-'+providerMic),
      label+'/'+mic+': no-trade Euronext ISIN/venue URL mismatch');
  }
  if(item.provider==='bse-budapest-calendar'){
    check(item.sourceUrl===BUDAPEST_CALENDAR_URL&&isOfficialBudapestClosedDate(cutoff)&&
      item.verification==='OFFICIAL_MARKET_CLOSED_RESOLUTION_380_2025'&&
      item.marketClosed===true&&item.lastTradeDate===null&&item.bar===undefined,
      label+'/'+mic+': Budapest official full-session closure evidence incomplete');
  }
  if(item.provider==='mse-official-price-list'){
    check(item.readOnly===true&&
      ['OFFICIAL_LAST_TRADE_BEFORE_PRICE_LIST_SESSION','OFFICIAL_LATER_SNAPSHOT_PROVES_NO_TARGET_SESSION_TRADE'].includes(item.verification)&&
      typeof item.lastTradeDate==='string'&&item.lastTradeDate<cutoff,
      label+'/'+mic+': Malta no-trade last-trade evidence incomplete');
  }else{
    check(item.trades===0&&item.volume===0,
      label+'/'+mic+': no-trade zero-volume/trades evidence incomplete');
  }
}
// An untraded stored reference candle is NEVER a valid current OHLC bar.
// It also must not erase independently verified official NO_TRADES for a later
// completed session. Keep the original no-trade gap bound AND require the
// exact approved official source/venue/ISIN proof, with no stored conflict.
export function isVerifiedNoTradeDespiteZeroVolumeReference(bar,status,{cutoff,catalogMic,isin,storedConflictDates=[]}={}){
  if(!bar||bar.volume!==0||!isCompleteOhlcBar(bar)||typeof cutoff!=='string'||
     bar.date>=cutoff||status?.isin!==isin||
     storedConflictDates.includes(bar.date)||
     !isVerifiedNoTradeGap(status,bar.date,cutoff))return false;
  try{verifyOfficialNoTrade(status,catalogMic,cutoff,'stored-reference');return true;}
  catch{return false;}
}

function validate(run,label){
  check(run&&typeof run==='object',label+': missing summary');
  check(run.shardsComplete===true,label+': incomplete shards');
  check(run.marketCoverage?.complete===true,label+': market coverage incomplete');
  for(const k of ['expectedMarkets','reportedUpdateMarkets','reportedAuditMarkets'])
    check(run.marketCoverage[k]===31,label+': '+k+' not 31');
  check(Array.isArray(run.marketCoverage.anomalies)&&run.marketCoverage.anomalies.length===0,label+': market anomalies');
  const cutoff=run.freshnessCutoff;
  check(typeof cutoff==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(cutoff)&&
    new Date(cutoff+'T00:00:00Z').toISOString().slice(0,10)===cutoff&&
    run.sessionConsistency?.complete===true&&run.sessionConsistency.cutoff===cutoff&&
    Array.isArray(run.sessionConsistency.observedCutoffs)&&
    run.sessionConsistency.observedCutoffs.length===1&&run.sessionConsistency.observedCutoffs[0]===cutoff&&
    Array.isArray(run.sessionConsistency.anomalies)&&run.sessionConsistency.anomalies.length===0,
    label+': unverified cutoff/session');
  check(Array.isArray(run.markets)&&run.markets.length===31,label+': not 31 markets');
  const totals={catalog:0,currentOpenClose:0,verifiedNoTrades:0,missingOpenClose:0};
  const markets=new Map(),missing=new Map(),noTrade=new Map();
  for(const m of run.markets){
    check(typeof m.mic==='string'&&/^[A-Z0-9]{4}$/.test(m.mic)&&!markets.has(m.mic),label+': invalid/duplicate MIC');
    for(const k of ['catalog','openCloseOk','verifiedNoTrades','missingOpenClose'])
      check(natural(m[k]),label+'/'+m.mic+': invalid '+k);
    check(m.catalog===m.openCloseOk+m.verifiedNoTrades+m.missingOpenClose,label+'/'+m.mic+': partition mismatch');
    check(Array.isArray(m.missing)&&m.missing.length===m.missingOpenClose,label+'/'+m.mic+': missing details incomplete');
    check(Array.isArray(m.noTrades)&&m.noTrades.length===m.verifiedNoTrades,label+'/'+m.mic+': no-trade details incomplete');
    markets.set(m.mic,m);
    totals.catalog+=m.catalog;totals.currentOpenClose+=m.openCloseOk;
    totals.verifiedNoTrades+=m.verifiedNoTrades;totals.missingOpenClose+=m.missingOpenClose;
    for(const [items,target,kind] of [[m.missing,missing,'missing'],[m.noTrades,noTrade,'no-trade']]){
      for(const item of items){
        // Existing Iceland catalog uses explicit MIC:symbol placeholders for eight
        // instruments without an ISIN. They are NOT verified ISIN mappings.
        const isIsin=typeof item.isin==='string'&&/^[A-Z]{2}[A-Z0-9]{10}$/.test(item.isin);
        const isCatalogPlaceholder=m.mic==='XICE'&&typeof item.isin==='string'&&
          /^XICE:[A-Z0-9._-]{1,32}$/.test(item.isin);
        check(isIsin||isCatalogPlaceholder,label+'/'+m.mic+': unrecognized catalog identifier');
        if(kind==='no-trade')verifyOfficialNoTrade(item,m.mic,cutoff,label);
        const k=id(m.mic,item.isin);
        check(!target.has(k),label+'/'+m.mic+': duplicate '+kind+' ISIN');
        target.set(k,{mic:m.mic,isin:item.isin,identifierType:isIsin?'ISIN':'NON_ISIN_CATALOG_KEY',symbol:item.symbol??null,
          ...(kind==='missing'?{reason:item.reason??null,lastDate:item.lastDate??null}:{})});
      }
    }
  }
  for(const k of missing.keys())check(!noTrade.has(k),label+': missing and no-trade overlap');
  for(const [k,v] of Object.entries(totals))check(run.totals?.[k]===v,label+': inconsistent '+k);
  // An incomplete failure list could hide provider regressions while all OHLC
  // partitions still add up. Import failures must be a unique subset of missing.
  check(natural(run.totals?.failedImports),label+': invalid failedImports total');
  check(Array.isArray(run.importFailures)&&run.importFailures.length===run.totals.failedImports,
    label+': import failure details incomplete');
  const failures=new Map();
  for(const failure of run.importFailures){
    const k=id(failure?.mic,failure?.isin);
    check(missing.has(k),label+': import failure not in missing inventory');
    check(!failures.has(k),label+': duplicate import failure');
    check(typeof failure.symbol==='string'&&failure.symbol===missing.get(k).symbol,
      label+': import failure ticker drift');
    check(typeof failure.category==='string'&&/^[A-Z][A-Z0-9_]*$/.test(failure.category),
      label+': invalid import failure category');
    failures.set(k,{mic:failure.mic,isin:failure.isin,symbol:failure.symbol,category:failure.category});
  }
  // The production summary also publishes a per-market provider-failure
  // histogram. Cross-check that independent rollup against the immutable
  // instrument failures before reporting a trustworthy same-cutoff delta.
  const sourceSummary=run.sourceFailureByMarket;
  check(sourceSummary&&typeof sourceSummary==='object'&&!Array.isArray(sourceSummary)&&
    Object.keys(sourceSummary).length===markets.size,label+': source failure MIC coverage incomplete');
  for(const mic of markets.keys()){
    const row=sourceSummary[mic];
    const actual=[...failures.values()].filter(f=>f.mic===mic);
    check(row&&natural(row.failed)&&row.failed===actual.length,
      label+'/'+mic+': source failure count mismatch');
    const actualCategories=new Map();
    for(const failure of actual)actualCategories.set(failure.category,(actualCategories.get(failure.category)||0)+1);
    const reported=row.categories;
    check(reported&&typeof reported==='object'&&!Array.isArray(reported)&&
      Object.keys(reported).length===actualCategories.size,
      label+'/'+mic+': source failure categories incomplete');
    for(const [category,count] of actualCategories){
      check(reported[category]===count,label+'/'+mic+': source failure category count mismatch');
    }
  }
  return {totals:{...totals,failedImports:failures.size},markets,missing,noTrade,failures};
}
export function compareEuropeSessionDeltas(before,after){
  const a=validate(before,'before'),b=validate(after,'after');
  check(before.freshnessCutoff===after.freshnessCutoff,'different trading-session cutoffs');
  check(a.totals.catalog===b.totals.catalog,'catalog changed');
  for(const [mic,m] of a.markets)
    check(b.markets.has(mic)&&b.markets.get(mic).catalog===m.catalog,mic+': catalog/market membership changed');
  // A changed ticker for the same MIC/ISIN can invalidate a longitudinal comparison.
  // Current-OHLC rows are not listed in the summary, so their identity is never inferred.
  for(const [k,oldItem] of a.missing){
    const next=b.missing.get(k)??b.noTrade.get(k);
    if(next)check(oldItem.symbol===next.symbol,'ticker changed for '+oldItem.mic+'/'+oldItem.isin);
  }
  for(const [k,oldItem] of a.noTrade){
    const next=b.missing.get(k)??b.noTrade.get(k);
    if(next)check(oldItem.symbol===next.symbol,'ticker changed for '+oldItem.mic+'/'+oldItem.isin);
  }
  const removed=[...a.missing].filter(([k])=>!b.missing.has(k)).map(([k,v])=>({
    ...v,after:b.noTrade.has(k)?'OFFICIAL_NO_TRADE':'NO_LONGER_MISSING_UNVERIFIED_PER_INSTRUMENT'}));
  const added=[...b.missing].filter(([k])=>!a.missing.has(k)).map(([,v])=>v);
  // An official NO_TRADES classification is a separate evidence state. Changes
  // must be traceable per MIC/identifier, not inferred from aggregate counts:
  // a disappearance is NOT proof of trading or a newly appended OHLC bar.
  const noTradeRemoved=[...a.noTrade].filter(([k])=>!b.noTrade.has(k))
    .map(([k,v])=>({...v,after:b.missing.has(k)?'MISSING':'NO_LONGER_OFFICIAL_NO_TRADE_UNVERIFIED'}));
  const noTradeAdded=[...b.noTrade].filter(([k])=>!a.noTrade.has(k))
    .map(([k,v])=>({...v,before:a.missing.has(k)?'MISSING':'PREVIOUSLY_NOT_OFFICIAL_NO_TRADE_UNVERIFIED'}));
  const reasonChanges=[...b.missing].filter(([k,v])=>a.missing.has(k)&&a.missing.get(k).reason!==v.reason)
    .map(([k,v])=>({mic:v.mic,isin:v.isin,before:a.missing.get(k).reason,after:v.reason}));
  const failureRemoved=[...a.failures].filter(([k])=>!b.failures.has(k)).map(([,v])=>v);
  const failureAdded=[...b.failures].filter(([k])=>!a.failures.has(k)).map(([,v])=>v);
  const failureCategoryChanges=[...b.failures].filter(([k,v])=>
    a.failures.has(k)&&a.failures.get(k).category!==v.category)
    .map(([k,v])=>({mic:v.mic,isin:v.isin,before:a.failures.get(k).category,after:v.category}));
  const sort=(x,y)=>x.mic.localeCompare(y.mic)||x.isin.localeCompare(y.isin);
  removed.sort(sort);added.sort(sort);reasonChanges.sort(sort);
  noTradeRemoved.sort(sort);noTradeAdded.sort(sort);
  failureRemoved.sort(sort);failureAdded.sort(sort);failureCategoryChanges.sort(sort);
  check(a.missing.size-removed.length+added.length===b.missing.size,'identity arithmetic mismatch');
  check(a.noTrade.size-noTradeRemoved.length+noTradeAdded.length===b.noTrade.size,
    'official no-trade identity arithmetic mismatch');
  check(a.failures.size-failureRemoved.length+failureAdded.length===b.failures.size,
    'failure identity arithmetic mismatch');
  const countByMic=items=>{
    const counts=new Map();
    for(const item of items)counts.set(item.mic,(counts.get(item.mic)||0)+1);
    return counts;
  };
  const reasonChangesByMic=countByMic(reasonChanges);
  const categoryChangesByMic=countByMic(failureCategoryChanges);
  const beforeFailuresByMic=countByMic([...a.failures.values()]);
  const afterFailuresByMic=countByMic([...b.failures.values()]);
  const byMarket=[...a.markets.keys()].sort().map(mic=>{
    const x=a.markets.get(mic),y=b.markets.get(mic);
    return {mic,catalog:x.catalog,currentOhlcDelta:y.openCloseOk-x.openCloseOk,
      noTradeDelta:y.verifiedNoTrades-x.verifiedNoTrades,
      missingDelta:y.missingOpenClose-x.missingOpenClose,
      missingRemoved:removed.filter(v=>v.mic===mic).length,
      missingAdded:added.filter(v=>v.mic===mic).length,
      officialNoTradeRemoved:noTradeRemoved.filter(v=>v.mic===mic).length,
      officialNoTradeAdded:noTradeAdded.filter(v=>v.mic===mic).length,
      failedImportsDelta:(afterFailuresByMic.get(mic)||0)-(beforeFailuresByMic.get(mic)||0),
      failureRemoved:failureRemoved.filter(v=>v.mic===mic).length,
      failureAdded:failureAdded.filter(v=>v.mic===mic).length,
      // Category-only and reason-only changes matter even with stable totals.
      missingReasonChanges:reasonChangesByMic.get(mic)||0,
      failureCategoryChanges:categoryChangesByMic.get(mic)||0};
  });
  check(byMarket.every(v=>v.noTradeDelta===v.officialNoTradeAdded-v.officialNoTradeRemoved&&
    v.missingDelta===v.missingAdded-v.missingRemoved&&
    v.failedImportsDelta===v.failureAdded-v.failureRemoved&&
    v.currentOhlcDelta+v.noTradeDelta+v.missingDelta===0),'market transition arithmetic mismatch');
  return {mode:'READ_ONLY_SAME_CUTOFF_INSTRUMENT_DELTA',status:'COMPLETE_COMPARISON',
    freshnessCutoff:before.freshnessCutoff,
    before:{currentOhlc:a.totals.currentOpenClose,noTrade:a.totals.verifiedNoTrades,missing:a.missing.size,
      failedImports:a.failures.size},
    after:{currentOhlc:b.totals.currentOpenClose,noTrade:b.totals.verifiedNoTrades,missing:b.missing.size,
      failedImports:b.failures.size},
    removed,added,noTradeRemoved,noTradeAdded,reasonChanges,failureRemoved,failureAdded,failureCategoryChanges,
    byMarket:byMarket.filter(v=>v.currentOhlcDelta||v.noTradeDelta||v.missingDelta||
      v.failedImportsDelta||v.missingReasonChanges||v.failureCategoryChanges),
    productionWrites:0,mappingsApproved:0,catalogMembershipVerified:false,
    nonIsinCatalogKeys:{before:[...a.missing.values(),...a.noTrade.values()].filter(v=>v.identifierType==='NON_ISIN_CATALOG_KEY').length,
      after:[...b.missing.values(),...b.noTrade.values()].filter(v=>v.identifierType==='NON_ISIN_CATALOG_KEY').length},
    warning:'NO_LONGER_MISSING and NO_LONGER_OFFICIAL_NO_TRADE are not proof of a new appended bar or actual trading. Check official source evidence, immutable shard artifacts and stored history before claiming a price repair.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.length!==4){console.error('Usage: node compare-europe-session-deltas.mjs <before-summary.json> <after-summary.json>');process.exitCode=2;}
  else try{
    const [a,b]=await Promise.all(process.argv.slice(2).map(async p=>JSON.parse(await readFile(p,'utf8'))));
    console.log(JSON.stringify(compareEuropeSessionDeltas(a,b),null,2));
  }catch(e){console.error(String(e));process.exitCode=2;}
}
