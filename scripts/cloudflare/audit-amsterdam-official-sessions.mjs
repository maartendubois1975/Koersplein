// Read-only XAMS missing-session classification. No data imports, no public price writes.
// An official NO_TRADES session is not an OHLC candle; a TRADED candidate is not
// automatically licensed for redistribution.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {AMSTERDAM_REFERENCE_WEEK,collectMarketWeek,validTradedBar} from '../../market-week-core.mjs';
import {officialDailyStatus} from '../history/official-daily-status.mjs';
const dates=AMSTERDAM_REFERENCE_WEEK,cutoff=dates.at(-1);
// Transient Worker timeouts must not prevent the independent public-page audit.
export async function fetchManifestWithRetry(base,fetchImpl=globalThis.fetch,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))){
 let lastError;
 for(let attempt=0;attempt<3;attempt++){
  try{
   const response=await fetchImpl(base+'/api/history/manifest.json',{signal:AbortSignal.timeout(30000)});
   if(response.ok)return await response.json();
   if(response.status!==429&&response.status<500)throw Error('XAMS_MANIFEST_PERMANENT_HTTP_'+response.status);
   lastError=Error('XAMS_MANIFEST_HTTP_'+response.status);
  }catch(error){
   if(String(error?.message||'').startsWith('XAMS_MANIFEST_PERMANENT_HTTP_'))throw error;
   lastError=error;
  }
  if(attempt<2)await wait(1000*(attempt+1));
 }
 throw lastError;
}
export function classifyOfficialSession(status,share,date){
 if(!status)return 'NO_OFFICIAL_SESSION_EVIDENCE';
 if(status.date!==date||status.mic!=='XAMS'||String(status.isin||'').toUpperCase()!==String(share.isin||'').toUpperCase())return 'OFFICIAL_IDENTITY_OR_DATE_MISMATCH';
 if(status.status==='NO_TRADES'&&status.volume===0&&status.trades===0)return 'OFFICIAL_NO_TRADES';
 if(status.status==='TRADED'&&validTradedBar(status.bar)&&status.bar.date===date)return 'OFFICIAL_TRADED_CANDIDATE';
 return 'OFFICIAL_UNVERIFIED_STATUS';
}
if(process.argv.includes('--self-test')){
 const share={isin:'NL0000000001'},date=dates[0],bar={date,open:10,high:11,low:9,close:10.5,volume:100};
 assert.equal(classifyOfficialSession({date,mic:'XAMS',isin:share.isin,status:'TRADED',bar},share,date),'OFFICIAL_TRADED_CANDIDATE');
 assert.equal(classifyOfficialSession({date,mic:'XAMS',isin:share.isin,status:'TRADED',bar:{...bar,volume:0}},share,date),'OFFICIAL_UNVERIFIED_STATUS');
 assert.equal(classifyOfficialSession({date,mic:'XAMS',isin:share.isin,status:'NO_TRADES',volume:0,trades:0},share,date),'OFFICIAL_NO_TRADES');
 assert.equal(classifyOfficialSession({date,mic:'XBRU',isin:share.isin,status:'NO_TRADES',volume:0,trades:0},share,date),'OFFICIAL_IDENTITY_OR_DATE_MISMATCH');
 assert.equal(classifyOfficialSession({date,mic:'XAMS',isin:share.isin,status:'NO_TRADES',volume:0,trades:null},share,date),'OFFICIAL_UNVERIFIED_STATUS');
 let attempts=0;
 const manifest=await fetchManifestWithRetry('https://fixture',async()=>{
  if(++attempts<3)throw Error('transient timeout');
  return {ok:true,json:async()=>({instruments:{}})};
 },async()=>{});
 assert.deepEqual(manifest,{instruments:{}});
 assert.equal(attempts,3,'Transient manifest failures are retried only twice');
 console.log('XAMS official session identity, volume and no-trade gates PASS');
}else{
 const base=String(process.env.KOERSPLEIN_API_URL||'https://koersplein.maarten-dubois1975.workers.dev').replace(/\/$/,'');
 const catalog=JSON.parse(await fs.readFile('data/euronext-amsterdam.json','utf8')).shares||[];
 const manifest=await fetchManifestWithRetry(base);
 const stored=await collectMarketWeek({catalog,manifest,apiBase:base,mic:'XAMS',dates,concurrency:6});
 const tasks=stored.rows.flatMap(row=>dates.filter(date=>!row.bars.has(date)).map(date=>({row,date})));
 const results=Array(tasks.length);let cursor=0;
 await Promise.all(Array.from({length:Math.min(6,tasks.length)},async()=>{
  while(cursor<tasks.length){
   const index=cursor++,{row,date}=tasks[index];
   const record={date,isin:row.share.isin,ticker:row.share.symbol,storedReason:row.error||row.conflicts.find(x=>x.date===date)?.reason||'NO_VALID_STORED_BAR'};
   results[index]=record;
   try{
    const status=await officialDailyStatus({...row.share,mic:'XAMS',market:'XAMS',currency:'EUR',officialIsin:row.share.isin},date);
    record.classification=classifyOfficialSession(status,row.share,date);
    if(status){record.source=status.provider||null;record.sourceUrl=status.sourceUrl||null;record.lastTradeDate=status.lastTradeDate||null;record.volume=status.volume??status.bar?.volume??null;}
   }catch(error){record.classification='OFFICIAL_SOURCE_ERROR';record.error=String(error?.message||error).slice(0,200);}
  }
 }));
 const perDay=Object.fromEntries(dates.map(date=>{
  const items=results.filter(r=>r.date===date),statuses={};
  for(const r of items)statuses[r.classification]=(statuses[r.classification]||0)+1;
  return [date,{storedValid:stored.coverage.perDay[date].valid,storedMissing:items.length,statuses}];
 }));
 const report={generatedAt:new Date().toISOString(),commit:process.env.GITHUB_SHA||null,mic:'XAMS',cutoff,
  scope:'READ_ONLY_EXACT_SESSION_OFFICIAL_STATUS',catalog:stored.coverage.catalog,storedCoverage:stored.coverage,
  perDay,results,warnings:[
   'NO_TRADES means no executed opening/closing trade can be invented.',
   'A historical official trade candidate is NOT approved for commercial redistribution.',
   'No history was written or overwritten. Existing invalid bars remain quarantined.',
   'Source errors and absent source rows are NOT evidence of NO_TRADES.'
  ]};
 await fs.mkdir('research/output/audit',{recursive:true});
 await fs.writeFile('research/output/audit/amsterdam-official-session-status.json',JSON.stringify(report,null,2)+'\n');
 console.log('XAMS_OFFICIAL_SESSION_AUDIT '+JSON.stringify({cutoff,catalog:stored.coverage.catalog,storedValid:stored.coverage.validSessions,perDay,unresolved:results.filter(r=>!['OFFICIAL_NO_TRADES','OFFICIAL_TRADED_CANDIDATE'].includes(r.classification)).length}));
}
