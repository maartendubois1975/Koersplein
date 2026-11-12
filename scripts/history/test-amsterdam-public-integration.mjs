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
const withoutReferenceWeek=snapshot.rows.filter(x=>x.bars.size===0);
assert.deepEqual(withoutReferenceWeek.map(x=>x.share.isin),['NL0000285278'],
  'Only the explicitly reviewed thinly-traded Bever series may lack reference-week observations');
const bever=await read('data/history/NL0000285278.json');
assert.equal(bever.instrument?.isin,'NL0000285278');
assert.ok(bever.bars.length>=2,'Bever must have independently stored historical candles');
assert.equal(new Set(bever.bars.map(x=>x.date)).size,bever.bars.length,'Bever dates must be unique');
assert.equal(report.sharesWithReferenceWeekPrices,79,'All other 79 instruments require real reference-week observations');
assert.ok(report.validWeekSessions>=389,'At least 389 of 400 possible observed sessions must be present; missing candles remain missing');
