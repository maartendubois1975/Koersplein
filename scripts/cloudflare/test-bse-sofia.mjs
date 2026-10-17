import assert from 'node:assert/strict';
import {BseSofiaProvider,parseBseBars,parseBseIdentity} from '../history/providers/bse-sofia.mjs';
const i={mic:'XBUL',symbol:'SFA',isin:'BG11SOSOBT18'},range={startDate:'2026-10-16',endDate:'2026-10-16'};
const metadata={'1':{result:{data:[['BSE Code','SFA'],['ISIN Code','BG11SOSOBT18'],['Security Type','shares'],['Trading currency','EUR']]}}};
const chart={s:'ok',t:[1792108800],o:[2.79],h:[2.95],l:[2.76],c:[2.92],v:[139942]};
assert.equal(parseBseIdentity(metadata,'SFA',i.isin).currency,'EUR');
assert.throws(()=>parseBseIdentity(metadata,'SPDY',i.isin),/identity mismatch/);
assert.throws(()=>parseBseIdentity(metadata,'SFA','BG1100007126'),/identity mismatch/);
assert.equal(parseBseBars(chart,range,'EUR')[0].open,2.79);
assert.equal(parseBseBars({...chart,o:[null]},range,'EUR').length,0);
assert.equal(parseBseBars({...chart,v:[0]},range,'EUR').length,0);
assert.throws(()=>parseBseBars({...chart,o:[]},range,'EUR'),/lengths mismatch/);
const original=globalThis.fetch,calls=[];const signal=new AbortController().signal;
try{
 globalThis.fetch=async(url,options)=>{calls.push([String(url),options]);return new Response(JSON.stringify(calls.length===1?metadata:chart),{status:200,headers:{'content-type':'application/json'}});};
 const result=await new BseSofiaProvider().fetchDaily(i,{...range,signal});
 assert.equal(result.bars[0].close,2.92);assert.equal(result.bars[0].currency,'EUR');
 assert.equal(calls.length,2);assert.ok(calls.every(x=>x[1].signal===signal));
 const url=new URL(calls[1][0]);assert.equal(url.searchParams.get('symbol'),'SFA');assert.equal(url.searchParams.get('resolution'),'1D');
 assert.equal(new URLSearchParams(calls[0][1].body).get('profilmarketinfo_1[parameters][code]'),'SFA');
}finally{globalThis.fetch=original;}
console.log('BSE Sofia: exact official ISIN, genuine OHLC, quote currency, malformed arrays and abort signal OK');
