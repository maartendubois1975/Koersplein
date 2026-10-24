import assert from 'node:assert/strict';
import {YahooChartProvider} from '../history/providers/yahoo-chart.mjs';

const chart=new YahooChartProvider();
const valor={isin:'AT0000KTMI02',mic:'XSWX',ticker:'41860974',currency:'CHF'};
assert.equal(chart.supports(valor),false);
assert.equal(chart.providerSymbolFor(valor),null,'Do not manufacture <numeric SIX valor>.SW in direct calls');
const verified={...valor,providerSymbol:'BMAG.SW'};
assert.equal(chart.providerSymbolFor(verified),'BMAG.SW');
const meta={symbol:'BMAG.SW',exchangeName:'EBS',fullExchangeName:'SIX Swiss Exchange',currency:'CHF'};
assert.doesNotThrow(()=>chart.validateIdentity(verified,meta));
assert.throws(()=>chart.validateIdentity(verified,{...meta,currency:'USD'}),/Providervaluta wijkt af/);
assert.throws(()=>chart.validateIdentity(verified,{...meta,currency:null}),/Providervaluta wijkt af/);
assert.throws(()=>chart.validateIdentity(verified,{...meta,exchangeName:'LSE',fullExchangeName:'London Stock Exchange'}),/Providerbeurs wijkt af/);
assert.throws(()=>chart.validateIdentity(verified,{...meta,symbol:'WRONG.SW'}),/Providersymbool wijkt af/);
assert.throws(()=>chart.validateIdentity({...verified,allowProviderExchangeMismatch:true},{...meta,exchangeName:'LSE',fullExchangeName:'London Stock Exchange'}),/Providerbeurs wijkt af/,
 'Even a legacy venue-bypass flag must not approve another exchange');
assert.throws(()=>chart.validateIdentity({...verified,allowProviderExchangeMismatch:true},{...meta,exchangeName:null,fullExchangeName:null}),/Providerbeurs ontbreekt/,
 'Swiss fallback without venue metadata is unverified');

// Exercise the actual Yahoo ISIN search -> chart fallback path: a matching
// search ISIN, .SW suffix and CHF quote still cannot override a wrong venue.
const {YahooIsinProvider}=await import('../history/providers/yahoo-isin.mjs');
const resolver=new YahooIsinProvider(),originalFetch=globalThis.fetch;
let observedVenue='LSE',chartRequests=0;
try{
 globalThis.fetch=async url=>{
  if(String(url).includes('/v1/finance/search'))return {ok:true,async json(){return {quotes:[
   {symbol:'BMAG.SW',isin:valor.isin,quoteType:'EQUITY'}
  ]};}};
  chartRequests++;
  return {ok:true,async json(){return {chart:{result:[{
   meta:{symbol:'BMAG.SW',exchangeName:observedVenue,fullExchangeName:observedVenue==='LSE'?'London Stock Exchange':'SIX Swiss Exchange',currency:'CHF'},
   timestamp:[Math.floor(Date.parse('2026-10-22T12:00:00Z')/1000)],
   indicators:{quote:[{open:[100],high:[105],low:[95],close:[102],volume:[10]}]}
  }]}};}};
 };
 await assert.rejects(()=>resolver.fetchDaily(valor,{startDate:'2026-10-22',endDate:'2026-10-22'}),/Providerbeurs wijkt af/,
  'A Swiss ISIN search hit with London metadata cannot become a SIX candle');
 observedVenue='EBS';
 const valid=await resolver.fetchDaily(valor,{startDate:'2026-10-22',endDate:'2026-10-22'});
 assert.equal(valid.providerMeta.exchangeName,'EBS');
 assert.equal(valid.bars[0].close,102);
 assert.equal(chartRequests,2);
}finally{globalThis.fetch=originalFetch;}
console.log('Swiss ISIN resolver rejects wrong-venue candles and retains verified SIX quotes PASS');

console.log('Swiss Yahoo numeric valor, verified override, MIC and currency identity PASS');

import fs from 'node:fs/promises';
const catalog=JSON.parse(await fs.readFile('data/euronext-zurich.json','utf8'));
for(const [isin,valorNumber,symbol] of [
 ['AT0000KTMI02','41860974','BMAG.SW'],
 ['CH0042797206','4279720','SQL.SW'],
 ['CH1216478797','121647879','DSFIR.SW']
]){
 const shares=catalog.shares.filter(x=>x.isin===isin);
 assert.equal(shares.length,1,'Unique official Swiss ISIN '+isin);
 const share=shares[0];
 assert.equal(share.symbol,valorNumber,'Preserve original SIX valor for '+isin);
 assert.equal(share.providerSymbol,symbol,'Only verified Yahoo provider override for '+isin);
 assert.equal(share.currency,'CHF');
 assert.equal(chart.providerSymbolFor(share),symbol);
 assert.ok(share.providerSymbolEvidence?.officialSix?.startsWith('https://www.six-group.com/'));
 assert.ok(share.providerSymbolEvidence?.yahooSwiss?.startsWith('https://finance.yahoo.com/quote/'));
}
console.log('Three verified SIX catalog overrides preserve original ISIN/valor/currency PASS');
