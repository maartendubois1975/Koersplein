// Read-only production audit for Amsterdam's fixed five-session reference week.
import fs from 'node:fs/promises';
import {AMSTERDAM_REFERENCE_WEEK,collectMarketWeek} from '../../market-week-core.mjs';
const base=String(process.env.KOERSPLEIN_API_URL||'https://koersplein.maarten-dubois1975.workers.dev').replace(/\/$/,'');
const catalog=JSON.parse(await fs.readFile('data/euronext-amsterdam.json','utf8')).shares||[];
const manifestResponse=await fetch(base+'/api/history/manifest.json',{signal:AbortSignal.timeout(30000)});
if(!manifestResponse.ok)throw Error('XAMS_MANIFEST_HTTP_'+manifestResponse.status);
const manifest=await manifestResponse.json();
const week=await collectMarketWeek({catalog,manifest,apiBase:base,mic:'XAMS',dates:AMSTERDAM_REFERENCE_WEEK,concurrency:6});
const errors={},providers={},missingByDay={},missingReasonsByDay={},examples=[];
for(const date of AMSTERDAM_REFERENCE_WEEK){missingByDay[date]=[];missingReasonsByDay[date]={};}
for(const row of week.rows){
 if(row.error)errors[row.error]=(errors[row.error]||0)+1;
 if(row.provider)providers[row.provider]=(providers[row.provider]||0)+1;
 for(const date of AMSTERDAM_REFERENCE_WEEK){
  if(row.bars.has(date))continue;
  const reason=row.error||row.conflicts.find(c=>c.date===date)?.reason||'NO_VALID_STORED_BAR';
  missingReasonsByDay[date][reason]=(missingReasonsByDay[date][reason]||0)+1;
  missingByDay[date].push({isin:row.share.isin,ticker:row.share.symbol,storageId:row.storageId,reason});
 }
 if(examples.length<12&&(!row.storageId||row.conflicts.length||row.error))examples.push({isin:row.share.isin,symbol:row.share.symbol,storageId:row.storageId,error:row.error,conflicts:row.conflicts});
}
// Identify why catalog securities cannot be joined, without silently borrowing another MIC's prices.
const unmatchedListings=week.rows.filter(row=>row.error==='NO_MATCHING_MIC_TICKER_HISTORY').map(row=>{
 const isin=String(row.share.isin||'').toUpperCase();
 const candidates=Object.entries(manifest.instruments||{}).filter(([id,entry])=>
  String(id).toUpperCase()===isin||
  String(id).toUpperCase().endsWith(':'+isin)||
  String(entry?.isin||'').toUpperCase()===isin
 ).map(([id,entry])=>({storageId:id,mic:entry?.mic||null,symbol:entry?.symbol||null})).slice(0,12);
 return {isin,symbol:row.share.symbol,candidates};
});
const report={
 generatedAt:new Date().toISOString(),commit:process.env.GITHUB_SHA||null,mic:'XAMS',week:AMSTERDAM_REFERENCE_WEEK,
 source:'PUBLIC_CLOUDFLARE_HISTORY_READ_ONLY',catalog:week.coverage.catalog,coverage:week.coverage,
 errors,providers,missingReasonsByDay,missingByDay,unmatchedListings,examples,notes:[
  'A valid session requires independent positive OHLC, coherent high/low and strictly positive volume.',
  'No-trade is not inferred from a missing history bar.',
  'Provider license and public redistribution permissions are not proven by this audit.',
  'Only stored bars are measured; no import, history overwrite or synthetic OHLC.'
 ]
};
await fs.mkdir('research/output/audit',{recursive:true});
await fs.writeFile('research/output/audit/amsterdam-week-coverage.json',JSON.stringify(report,null,2)+'\n');
console.log('XAMS_WEEK_AUDIT '+JSON.stringify({mic:'XAMS',week:AMSTERDAM_REFERENCE_WEEK,coverage:week.coverage,errors,providers,missingReasonsByDay,unmatchedListings,examples}));
if(week.coverage.catalog!==124)console.warn('XAMS_CATALOG_COUNT_CHANGED '+week.coverage.catalog);
if(!week.coverage.validSessions)process.exitCode=2;
