// Read-only, bounded source probe for missing Amsterdam sessions. NEVER imports or republishes prices.
// A historical AJAX response is not proof of commercial redistribution rights.
import fs from 'node:fs/promises';
import {AMSTERDAM_REFERENCE_WEEK,collectMarketWeek,weekCoverage,validTradedBar} from '../../market-week-core.mjs';
import {EuronextLiveProvider} from '../history/providers/euronext-live.mjs';
import {fetchXamsManifest} from './xams-manifest.mjs';
const dates=AMSTERDAM_REFERENCE_WEEK,cutoff=dates.at(-1);
const base=String(process.env.KOERSPLEIN_API_URL||'https://koersplein.maarten-dubois1975.workers.dev').replace(/\/$/,'');
const catalog=JSON.parse(await fs.readFile('data/euronext-amsterdam.json','utf8')).shares||[];
const manifest=await fetchXamsManifest(base);
const stored=await collectMarketWeek({catalog,manifest,apiBase:base,mic:'XAMS',dates,concurrency:6});
// A temporary Worker failure is not an absent traded candle. Retest only the
// affected instruments once before interpreting their five days as missing.
const transientError=row=>/^HISTORY_(?:TIMEOUT|FETCH_ERROR|HTTP_5\\d\\d)$/.test(String(row.error||''));
const retryIndexes=stored.rows.flatMap((row,i)=>transientError(row)?[i]:[]);
if(retryIndexes.length){
 const retry=await collectMarketWeek({catalog:retryIndexes.map(i=>catalog[i]),manifest,apiBase:base,mic:'XAMS',dates,concurrency:2});
 retryIndexes.forEach((index,i)=>{stored.rows[index]=retry.rows[i];});
 stored.coverage=weekCoverage(stored.rows,dates);
}
const unresolved=stored.rows.filter(transientError);
if(unresolved.length)throw Error('XAMS_STORAGE_SNAPSHOT_UNAVAILABLE: '+unresolved.map(row=>row.share.symbol).join(','));
const candidates=stored.rows.filter(row=>dates.some(d=>!row.bars.has(d)));
const provider=new EuronextLiveProvider();
const rows=Array(candidates.length);let cursor=0;
await Promise.all(Array.from({length:Math.min(4,candidates.length)},async()=>{
 while(cursor<candidates.length){
  const index=cursor++,row=candidates[index],missing=dates.filter(d=>!row.bars.has(d));
  const record={isin:row.share.isin,symbol:row.share.symbol,missing,sourceTradedDates:[],status:'NOT_PROBED'};
  rows[index]=record;
  try{
   // One bounded five-day official XAMS request per listing, not 113 independent requests.
   const instrument={...row.share,mic:'XAMS',market:'XAMS',currency:'EUR'};
   const response=await provider.fetchDaily(instrument,{startDate:dates[0],endDate:cutoff,signal:AbortSignal.timeout(16000)});
   const sourceDates=new Set((response.bars||[]).filter(validTradedBar).map(b=>b.date));
   record.sourceTradedDates=missing.filter(d=>sourceDates.has(d));
   record.status=record.sourceTradedDates.length?'OFFICIAL_SOURCE_HAS_TRADED_CANDIDATE':'NO_SOURCE_TRADE_FOR_MISSING_DATE';
  }catch(error){
   const message=String(error.message||error);
   // A successful official response with zero traded rows is not a network failure
   // and is not proof of an official NO_TRADES session.
   record.status=/^Geen verhandelde Euronext koershistorie voor .*; mislukte vensters: 0$/.test(message)
    ?'OFFICIAL_SOURCE_NO_TRADED_ROWS':'OFFICIAL_SOURCE_UNAVAILABLE';
   record.error=message.slice(0,180);
  }
 }
}));
const perDay=Object.fromEntries(dates.map(date=>[date,{
 storedValid:stored.coverage.perDay[date].valid,
 storedMissing:stored.coverage.perDay[date].missing,
 officialSourceCandidate:rows.filter(r=>r.sourceTradedDates.includes(date)).length,
 stillUnresolved:rows.filter(r=>r.missing.includes(date)&&!r.sourceTradedDates.includes(date)).length
}]));
const report={generatedAt:new Date().toISOString(),commit:process.env.GITHUB_SHA||null,mic:'XAMS',cutoff,
 scope:'READ_ONLY_OFFICIAL_SOURCE_DISCOVERY',storedCoverage:stored.coverage,perDay,rows,
 warnings:[
 'OFFICIAL_SOURCE_HAS_TRADED_CANDIDATE is not an approved import or evidence of redistribution rights.',
 'No source price is written to Cloudflare or published; no existing bar is overwritten.',
 'A missing source row is not official proof of no trades.',
 'Historical Euronext AJAX data may be adjusted; raw opening/closing price provenance must be checked before any import.',
 'All historical source data require independent legal redistribution approval before public use.'
]};
await fs.mkdir('research/output/audit',{recursive:true});
await fs.writeFile('research/output/audit/amsterdam-official-gap-probe.json',JSON.stringify(report,null,2)+'\n');
console.log('XAMS_OFFICIAL_GAP_PROBE '+JSON.stringify({cutoff,storedCoverage:stored.coverage,perDay,
 candidateListings:rows.filter(r=>r.sourceTradedDates.length).length,
 sourceUnavailable:rows.filter(r=>r.status==='OFFICIAL_SOURCE_UNAVAILABLE').length,
 sourceNoTradedRows:rows.filter(r=>r.status==='OFFICIAL_SOURCE_NO_TRADED_ROWS').length,
 noSourceTrade:rows.filter(r=>r.status==='NO_SOURCE_TRADE_FOR_MISSING_DATE').length,
 sample:rows.filter(r=>r.sourceTradedDates.length).slice(0,8)}));
