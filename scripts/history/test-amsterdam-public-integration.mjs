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
const report={catalog:snapshot.rows.length,mapped:mapped.length,filesLoaded:requests,sharesWithReferenceWeekPrices:withBars.length,validWeekSessions:snapshot.coverage.validSessions,invalidWeekSessions:invalid,errors:failures.map(x=>({symbol:x.share.symbol,error:x.error})),perDay:snapshot.coverage.perDay};
console.log('AMSTERDAM_PUBLIC_INTEGRATION',JSON.stringify(report));
assert.equal(report.catalog,85);
assert.equal(report.mapped,80);
assert.equal(report.filesLoaded,80);
assert.equal(report.errors.length,0,'Every mapped history must pass public MIC/ticker/ISIN/currency checks');
assert.ok(report.sharesWithReferenceWeekPrices>=65,'At least 65 mapped shares must have real week prices');
assert.ok(report.validWeekSessions>=300,'Historical week must have at least 300 verified sessions');
