import assert from 'node:assert/strict';
import {parseSixIpoPairs} from '../cloudflare/six-ipo-symbol-evidence.mjs';
import {selectIpoIdentityCandidates,probeSixIpoCurrent,fetchSixIpoHtml,IPO_URL} from './six-ipo-current-identity.mjs';
const pair=(isin,symbol)=>'<p>ISIN : '+isin+' Symbol : '+symbol+'</p>';
const historical=Array.from({length:20},(_,i)=>pair('CH'+String(i).padStart(9,'0')+'0','ABC')).join('')+
 pair('CH0311864901','VACN')+pair('CH0496451508','SWON');
const shares=[
 {isin:'CH0311864901',mic:'XSWX',symbol:'31186490',currency:'CHF'},
 {isin:'CH0496451508',mic:'XSWX',symbol:'49645150',currency:'CHF'},
 {isin:'CH0311864901',mic:'XLON',symbol:'31186490',currency:'CHF'},
 {isin:'CH0311864901',mic:'XSWX',symbol:'31186490',currency:'CHF',providerSymbol:'VACN.SW'}
];
const selected=selectIpoIdentityCandidates(shares,parseSixIpoPairs(historical),{limit:12,rotation:0});
assert.equal(selected.totalEligible,2);
assert.equal(selected.selected.length,2);
assert.throws(()=>selectIpoIdentityCandidates(shares,new Map(),{limit:25}),/BOUNDS/);
const yahoo=async i=>({providerMeta:{symbol:i.providerSymbol,currency:'CHF',exchangeName:'EBS',instrumentType:'EQUITY'},bars:[{date:'2026-10-22',open:100,high:102,low:99,close:101}]});
const page=async url=>'<title>Stock Price - '+(url.includes('CH0311864901')?'VACN':'SWON')+' | SIX</title>';
const report=await probeSixIpoCurrent(shares,{ipoHtml:historical,fetchHtml:page,fetchYahoo:yahoo,limit:2,asOfDate:'2026-10-23'});
assert.equal(report.officialIpoPairs,22);
assert.equal(report.requested,2);
assert.equal(report.counts.OFFICIAL_IPO_AND_CURRENT_TITLE_YAHOO_MATCH_REVIEW_ONLY,2);
assert.equal(report.productionMappingsCreated,0);
assert.equal(report.priceWrites,0);
assert(report.results.every(x=>x.approvedForProduction===false&&x.historicalSymbols.length===1));
const mismatch=await probeSixIpoCurrent(shares,{ipoHtml:historical,fetchHtml:async()=>'<title>Stock Price - WRONG | SIX</title>',limit:2});
assert.equal(mismatch.counts.IPO_SYMBOL_NOT_CURRENT_TITLE_MATCH,2);
const ambiguous=await probeSixIpoCurrent(shares,{ipoHtml:historical+pair('CH0311864901','OTHER'),fetchHtml:page,limit:2});
assert.equal(ambiguous.counts.AMBIGUOUS_HISTORICAL_IPO_SYMBOL,1);
assert.throws(()=>probeSixIpoCurrent(shares,{ipoHtml:'bad'}),/OFFICIAL_IPO_LIST_TOO_SMALL/);
await assert.rejects(fetchSixIpoHtml(async()=>({ok:true,url:'https://other.example',headers:{get:()=> 'text/html'},text:async()=>historical})),/SOURCE_NOT_VERIFIED/);
await assert.rejects(fetchSixIpoHtml(async()=>({ok:true,url:IPO_URL,headers:{get:k=>k==='content-type'?'text/html':'3000001'},text:async()=>historical})),/TOO_LARGE/);
console.log('SIX_IPO_CURRENT_IDENTITY_TEST_PASS',JSON.stringify({officialPairs:22,eligible:2,reviewOnly:2,priceWrites:0}));
