import assert from 'node:assert/strict';
import {AMSTERDAM_REFERENCE_WEEK,validDate,positiveNumber,validTradedBar,tradedBarDefect,sessionChange,manifestResolver,weekBars,weekCoverage,collectMarketWeek} from '../../market-week-core.mjs';
const days=AMSTERDAM_REFERENCE_WEEK;
const good=(date,open=100,close=105)=>({date,open,high:110,low:95,close,volume:200});
assert.equal(validDate('2026-10-23'),true);
assert.equal(validDate('2026-02-30'),false);
assert.equal(positiveNumber('  '),null);
assert.equal(positiveNumber(true),null);
assert.equal(validTradedBar(good(days[0])),true);
assert.equal(tradedBarDefect({...good(days[0]),volume:0}),'ZERO_VOLUME_REFERENCE_BAR');
assert.equal(tradedBarDefect({...good(days[0]),volume:null}),'MISSING_VOLUME');
assert.equal(tradedBarDefect({...good(days[0]),high:101}),'INCOMPLETE_OR_INVALID_OHLC');
for(const invalid of [{...good(days[0]),volume:0},{...good(days[0]),volume:null},{...good(days[0]),high:101},{...good(days[0]),low:106},{...good(days[0]),open:null},{...good(days[0]),date:'2026-02-30'}])
 assert.equal(validTradedBar(invalid),false,'Invalid OHLC must not count '+JSON.stringify(invalid));
assert.equal(sessionChange(100,105).absolute,5);
assert.ok(Math.abs(sessionChange(100,105).percent-5)<1e-10);
assert.equal(sessionChange(0,105),null);
const manifest={instruments:{
 'XAMS:NL111':{isin:'XAMS:NL111',mic:'XAMS',symbol:'AAA'},
 'XBRU:NL111':{isin:'XBRU:NL111',mic:'XBRU',symbol:'AAA'},
 'LEGACY-NL222':{isin:'LEGACY-NL222',mic:'XAMS',symbol:'BBB'}
}};
const resolve=manifestResolver(manifest,'XAMS');
assert.equal(resolve({isin:'NL111',symbol:'AAA'}),'XAMS:NL111','Crosslisted ISIN must resolve by MIC and ticker');
assert.equal(resolve({isin:'NL222',symbol:'BBB'}),'LEGACY-NL222');
assert.equal(resolve({isin:'NL111',symbol:'UNKNOWN'}),null,'No fallback to another ticker');
assert.equal(manifestResolver({instruments:{...manifest.instruments,'XAMS:ALT':{mic:'XAMS',symbol:'AAA'}}},'XAMS')({symbol:'AAA'}),null,'Ambiguous listing must fail closed');
const found=weekBars([good(days[0]),good(days[0]),{...good(days[1]),close:106},good(days[1]),good(days[2]),{...good(days[3]),volume:0}],days);
assert.equal(found.bars.has(days[0]),true,'Identical duplicates may be accepted');
assert.equal(found.bars.has(days[1]),false,'Conflicting same-day OHLC must be quarantined');
assert.equal(found.bars.has(days[3]),false,'Zero-volume bars are not traded prices');
assert.equal(found.conflicts.length,2);
const shares=[{isin:'NL111',symbol:'AAA',name:'A'},{isin:'NL222',symbol:'BBB',name:'B'}];
const calls=[];
const fetchImpl=async url=>{
 calls.push(url);
 const id=decodeURIComponent(url.split('/').at(-1));
 return {ok:true,json:async()=>({instrument:{mic:'XAMS',symbol:id==='XAMS:NL111'?'AAA':'BBB',currency:'EUR'},provider:{name:'fixture'},bars:id==='XAMS:NL111'?days.map(d=>good(d)):days.slice(0,4).map(d=>good(d))})};
};
const actual=await collectMarketWeek({catalog:shares,manifest,apiBase:'https://api.example',mic:'XAMS',dates:days,fetchImpl,concurrency:2});
assert.equal(actual.coverage.catalog,2);
assert.equal(actual.coverage.complete,1);
assert.equal(actual.coverage.validSessions,9);
assert.equal(actual.coverage.perDay[days[4]].valid,1);
assert.equal(actual.rows[0].storageId,'XAMS:NL111');
assert.equal(actual.rows[1].storageId,'LEGACY-NL222');
assert.equal(calls.length,2);
assert.ok(calls.some(url=>url.endsWith('/api/history/XAMS:NL111')),'MIC prefix must remain a literal colon for Worker path matching');
assert.deepEqual(weekCoverage(actual.rows,days),actual.coverage);
const mismatch=await collectMarketWeek({catalog:[shares[0]],manifest,apiBase:'https://api.example',mic:'XAMS',dates:days,fetchImpl:async()=>({ok:true,json:async()=>({instrument:{mic:'XBRU',symbol:'AAA'},bars:days.map(d=>good(d))})})});
assert.equal(mismatch.coverage.validSessions,0);
assert.equal(mismatch.rows[0].error,'HISTORY_LISTING_IDENTITY_MISMATCH');
console.log('Amsterdam week: MIC-safe identity, positive traded OHLC, conflict quarantine, five-day coverage and deltas PASS');
