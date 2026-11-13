import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {collectMarketWeek,AMSTERDAM_REFERENCE_WEEK} from '../../market-week-core.mjs';
const root=new URL('../../',import.meta.url);
const read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const catalog=await read('data/euronext-amsterdam.json');
const manifest=await read('data/amsterdam-history-manifest.json');
let requests=0;
const fetchImpl=async url=>{
 const isin=decodeURIComponent(String(url).split('/').at(-1));
 const file='data/history/'+isin+'.json';
 try {const json=await read(file);requests++;return {ok:true,status:200,json:async()=>json};}
 catch(error){if(error.code==='ENOENT')return {ok:false,status:404};throw error;}
};
const snapshot=await collectMarketWeek({catalog:catalog.shares,manifest,apiBase:'https://example.org',mic:'XAMS',dates:AMSTERDAM_REFERENCE_WEEK,fetchImpl,concurrency:8});
const mapped=snapshot.rows.filter(x=>x.storageId);
const withBars=snapshot.rows.filter(x=>x.bars.size>0);
const failures=snapshot.rows.filter(x=>x.storageId&&x.error);
const invalid=snapshot.rows.reduce((n,x)=>n+x.conflicts.length,0);
const missingSessions=snapshot.rows.flatMap(row=>AMSTERDAM_REFERENCE_WEEK.filter(date=>!row.bars.has(date)).map(date=>({symbol:row.share.symbol,isin:row.share.isin,date,mapped:!!row.storageId,lastStoredDate:row.lastStoredDate,error:row.error||null}))).filter(x=>x.mapped);
const report={missingSessions,catalog:snapshot.rows.length,mapped:mapped.length,filesLoaded:requests,sharesWithReferenceWeekPrices:withBars.length,validWeekSessions:snapshot.coverage.validSessions,invalidWeekSessions:invalid,errors:failures.map(x=>({symbol:x.share.symbol,error:x.error})),perDay:snapshot.coverage.perDay};
console.log('AMSTERDAM_PUBLIC_INTEGRATION',JSON.stringify(report));
assert.equal(report.catalog,80);
assert.equal(report.mapped,report.catalog);
assert.equal(report.filesLoaded,report.catalog);
assert.equal(report.errors.length,0,'Every mapped history must pass public MIC/ticker/ISIN/currency checks');
// A mapped and validated history can have zero observed trades in a fixed week.
// Never manufacture candles or treat an absent candle as a confirmed NO_TRADES session.
// Freeze the exact observed gap identities rather than accepting an arbitrary count.
// UNKNOWN means the provider has no candle; it does not establish a no-trade session.
const expectedUnresolved=[
 ['NL0010696704','2026-10-21'],['NL0010696704','2026-10-23'],
 ['NL0000285278','2026-10-19'],['NL0000285278','2026-10-20'],
 ['NL0000285278','2026-10-21'],['NL0000285278','2026-10-22'],
 ['NL0000285278','2026-10-23'],
 ['GB00BMXH3352','2026-10-19'],['GB00BMXH3352','2026-10-20'],
 ['NL0000378669','2026-10-19'],['NL0000378669','2026-10-22']
].map(([isin,date])=>isin+'@'+date).sort();
const observedUnresolved=missingSessions.map(x=>x.isin+'@'+x.date).sort();
assert.deepEqual(observedUnresolved,expectedUnresolved,
 'Any newly missing or recovered session requires fresh evidence review; never silently change a coverage threshold');
assert.equal(report.invalidWeekSessions,0);
assert.equal(report.validWeekSessions,report.catalog*AMSTERDAM_REFERENCE_WEEK.length-expectedUnresolved.length);
const bever=await read('data/history/NL0000285278.json');
assert.equal(bever.instrument?.isin,'NL0000285278');
assert.ok(bever.bars.length>=2,'Bever must have independently stored historical candles');
assert.equal(new Set(bever.bars.map(x=>x.date)).size,bever.bars.length,'Bever dates must be unique');
console.log('AMSTERDAM_UNRESOLVED_SESSION_EVIDENCE',JSON.stringify({
 scope:'PROVIDER_CANDLE_ABSENCE_NOT_CONFIRMED_NO_TRADE',
 observedUnresolved:missingSessions.map(x=>({isin:x.isin,symbol:x.symbol,date:x.date,classification:'UNRESOLVED_PROVIDER_ABSENCE'})),
 missingCount:missingSessions.length
}));
