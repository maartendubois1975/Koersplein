// Read-only XAMS missing-session classification. No data imports, no public price writes.
// An official NO_TRADES session is not an OHLC candle; a TRADED candidate is not
// automatically licensed for redistribution.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {AMSTERDAM_REFERENCE_WEEK,collectMarketWeek,validTradedBar} from '../../market-week-core.mjs';
import {officialDailyStatus} from '../history/official-daily-status.mjs';
import {fetchXamsManifest} from './xams-manifest.mjs';
const dates=AMSTERDAM_REFERENCE_WEEK,cutoff=dates.at(-1);
export function classifyOfficialSession(status,share,date){
 if(!status)return 'NO_OFFICIAL_SESSION_EVIDENCE';
 if(status.date!==date||status.mic!=='XAMS'||String(status.isin||'').toUpperCase()!==String(share.isin||'').toUpperCase())return 'OFFICIAL_IDENTITY_OR_DATE_MISMATCH';
 // Zero volume alone is never a no-trade certificate. Demand explicit, dated\n // complete-session transaction evidence from the approved XAMS source.\n if(status.status==='NO_TRADES'&&status.volume===0&&status.trades===0&&\n    status.provider==='euronext-live'&&status.verification==='COMPLETE_OFFICIAL_SESSION_TRADE_COUNT'&&\n    typeof status.sourceUrl==='string'&&status.sourceUrl.startsWith('https://live.euronext.com/'))return 'OFFICIAL_NO_TRADES';
 if(status.status==='TRADED'&&validTradedBar(status.bar)&&status.bar.date===date)return 'OFFICIAL_TRADED_CANDIDATE';
 return 'OFFICIAL_UNVERIFIED_STATUS';
}
if(process.argv.includes('--self-test')){
 const share={isin:'NL0000000001'},date=dates[0],bar={date,open:10,high:11,low:9,close:10.5,volume:100};
 assert.equal(classifyOfficialSession({date,mic:'XAMS',isin:share.isin,status:'TRADED',bar},share,date),'OFFICIAL_TRADED_CANDIDATE');
 assert.equal(classifyOfficialSession({date,mic:'XAMS',isin:share.isin,status:'TRADED',bar:{...bar,volume:0}},share,date),'OFFICIAL_UNVERIFIED_STATUS');
 assert.equal(classifyOfficialSession({date,mic:'XAMS',isin:share.isin,status:'NO_TRADES',volume:0,trades:0},share,date),'OFFICIAL_UNVERIFIED_STATUS');\n assert.equal(classifyOfficialSession({date,mic:'XAMS',isin:share.isin,status:'NO_TRADES',volume:0,trades:0,provider:'euronext-live',verification:'COMPLETE_OFFICIAL_SESSION_TRADE_COUNT',sourceUrl:'https://live.euronext.com/official-session'},share,date),'OFFICIAL_NO_TRADES');
 assert.equal(classifyOfficialSession({date,mic:'XBRU',isin:share.isin,status:'NO_TRADES',volume:0,trades:0},share,date),'OFFICIAL_IDENTITY_OR_DATE_MISMATCH');
 assert.equal(classifyOfficialSession({date,mic:'XAMS',isin:share.isin,status:'NO_TRADES',volume:0,trades:null},share,date),'OFFICIAL_UNVERIFIED_STATUS');
 let attempts=0;
 const manifest=await fetchXamsManifest('https://fixture',async()=>{
  if(++attempts<3)throw Error('transient timeout');
  return {ok:true,json:async()=>({instruments:{}})};
 },async()=>{});
 assert.deepEqual(manifest,{instruments:{}});
 assert.equal(attempts,3,'Transient manifest failures are retried only twice');
 console.log('XAMS official session identity, volume and no-trade gates PASS');
}else{
 const base=String(process.env.KOERSPLEIN_API_URL||'https://koersplein.maarten-dubois1975.workers.dev').replace(/\/$/,'');
 const catalog=JSON.parse(await fs.readFile('data/euronext-amsterdam.json','utf8')).shares||[];
 const manifest=await fetchXamsManifest(base);
 const stored=await collectMarketWeek({catalog,manifest,apiBase:base,mic:'XAMS',dates,concurrency:6});
 const quarantine=JSON.parse(await fs.readFile('data/amsterdam-no-trades-2026-10-19-23.json','utf8'));
 assert.equal(quarantine.mic,'XAMS');
 const gapProbe=JSON.parse(await fs.readFile('research/output/audit/amsterdam-official-gap-probe.json','utf8'));
 const micEvidence=JSON.parse(await fs.readFile('research/output/audit/amsterdam-official-mic-evidence.json','utf8'));
 assert.equal(gapProbe.mic,'XAMS');
 const probeCandidates=new Set(gapProbe.rows.flatMap(item=>(item.sourceTradedDates||[]).map(date=>item.isin+'|'+date)));
 const currentListings=new Map((micEvidence.listings||[]).map(item=>[item.isin+'|'+item.ticker,item]));
 const tasks=stored.rows.flatMap(row=>dates.filter(date=>!row.bars.has(date)).map(date=>({row,date})));
 const results=Array(tasks.length);let cursor=0;
 await Promise.all(Array.from({length:Math.min(6,tasks.length)},async()=>{
  while(cursor<tasks.length){
   const index=cursor++,{row,date}=tasks[index];
   const storedReason=row.error||row.conflicts.find(x=>x.date===date)?.reason||'NO_VALID_STORED_BAR';
   const invalid=Boolean(row.conflicts.some(x=>x.date===date))||/^(HISTORY_CURRENCY_MISMATCH|HISTORY_IDENTITY_MISMATCH)$/.test(storedReason);
   const listing=currentListings.get(row.share.isin+'|'+row.share.symbol);
   const record={date,mic:'XAMS',isin:row.share.isin,ticker:row.share.symbol,currency:row.currency||null,
    storageId:row.storageId||null,storedReason,storedStatus:invalid?'INVALID':'MISSING',
    unverifiedNoTradeCandidate:(quarantine.unverifiedNoTradeCandidates?.[row.share.isin]||[]).includes(date),
    currentMicEvidence:micEvidence.completeSourceSnapshot?(listing?.classification||'NO_CURRENT_DIRECTORY_MATCH'):'SOURCE_UNAVAILABLE',
    historicalListingAsOfDate:'UNVERIFIED',
    officialSourceTradedCandidate:probeCandidates.has(row.share.isin+'|'+date),
    redistributionRights:'NOT_CONFIRMED_FOR_PUBLIC_REUSE',
    safeImport:'BLOCKED_UNTIL_EXACT_IDENTITY_COMPLETE_OHLCV_AND_RIGHTS_VERIFIED'};
   results[index]=record;
   try{
    const status=await officialDailyStatus({...row.share,mic:'XAMS',market:'XAMS',currency:'EUR',officialIsin:row.share.isin},date);
    record.classification=classifyOfficialSession(status,row.share,date);
    if(status){record.source=status.provider||null;record.sourceUrl=status.sourceUrl||null;record.lastTradeDate=status.lastTradeDate||null;record.volume=status.volume??status.bar?.volume??null;
     record.positiveTradedVolume=Number(status.bar?.volume)>0&&validTradedBar(status.bar);
     record.transactionEvidence=status.verification||null;
    }
   }catch(error){record.classification='OFFICIAL_SOURCE_ERROR';record.error=String(error?.message||error).slice(0,200);}
  }
 }));
 const perDay=Object.fromEntries(dates.map(date=>{
  const items=results.filter(r=>r.date===date),statuses={};
  for(const r of items)statuses[r.classification]=(statuses[r.classification]||0)+1;
  return [date,{storedValid:stored.coverage.perDay[date].valid,storedMissing:items.length,statuses}];
 }));
 const generatedAt=new Date().toISOString();
 const totalUnverified=results.filter(r=>r.classification!=='OFFICIAL_NO_TRADES').length;
 const summary={expected:stored.coverage.expectedSessions,storedValid:stored.coverage.validSessions,
  unresolved:totalUnverified,officialNoTrades:results.length-totalUnverified,
  officialTradedCandidates:results.filter(r=>r.classification==='OFFICIAL_TRADED_CANDIDATE').length,
  unverifiedNoTradeCandidates:results.filter(r=>r.unverifiedNoTradeCandidate).length,
  invalidStored:results.filter(r=>r.storedStatus==='INVALID').length,
  missingStored:results.filter(r=>r.storedStatus==='MISSING').length,
  newlyImportedBars:0};
 assert.equal(summary.storedValid+results.length,summary.expected,'XAMS_GAP_INVENTORY_NOT_EXHAUSTIVE');
 const csvColumns=['date','mic','isin','ticker','currency','storageId','storedStatus','storedReason',
  'unverifiedNoTradeCandidate','currentMicEvidence','historicalListingAsOfDate','classification',
  'officialSourceTradedCandidate','positiveTradedVolume','source','sourceUrl','volume','redistributionRights','safeImport'];
 const csvCell=value=>'"'+String(value??'').replace(/"/g,'""')+'"';
 const csv=[csvColumns.join(','),...results.map(record=>csvColumns.map(column=>csvCell(record[column])).join(','))].join('\n')+'\n';
 await fs.writeFile('research/output/audit/amsterdam-gap-evidence.csv',csv);
 await fs.writeFile('research/output/audit/amsterdam-gap-evidence.json',JSON.stringify({
  generatedAt,mic:'XAMS',cutoff,scope:'READ_ONLY_EVIDENCE_INVENTORY_NOT_LICENSED_OHLC_IMPORT',
  summary,perDay,rows:results,
  notes:['Current MIC directory cannot prove listing on each historical date.',
   'No executed-trade count is inferred from zero-volume reference prices.',
   'Source availability does not grant public redistribution rights.']
 },null,2)+'\n');
 const report={generatedAt,commit:process.env.GITHUB_SHA||null,mic:'XAMS',cutoff,
  scope:'READ_ONLY_EXACT_SESSION_OFFICIAL_STATUS',catalog:stored.coverage.catalog,storedCoverage:stored.coverage,
  perDay,results,warnings:[
   'NO_TRADES means no executed opening/closing trade can be invented.',
   'A historical official trade candidate is NOT approved for commercial redistribution.',
   'No history was written or overwritten. Existing invalid bars remain quarantined.',
   'Source errors and absent source rows are NOT evidence of NO_TRADES.'
  ]};
 await fs.mkdir('research/output/audit',{recursive:true});
 await fs.writeFile('research/output/audit/amsterdam-official-session-status.json',JSON.stringify(report,null,2)+'\n');
 console.log('XAMS_OFFICIAL_SESSION_AUDIT '+JSON.stringify({cutoff,catalog:stored.coverage.catalog,storedValid:stored.coverage.validSessions,perDay,summary}));
}
