import assert from 'node:assert/strict';
import {ZsePriceListProvider} from '../history/providers/zse-price-list.mjs';
const original=globalThis.fetch;
try {
 const requested=[];
 globalThis.fetch=async url=>{
  const date=String(url).match(/\d{4}-\d{2}-\d{2}/)?.[0];
  requested.push(date);
  if(date==='2020-01-06')return new Response('Archive date unavailable',{status:400});
  return new Response('isin,open_price,high_price,low_price,close_price,volume,trade_date\nTESTZSE,10,12,9,11,100,2020-01-07\n');
 };
 const result=await new ZsePriceListProvider().fetchDaily({mic:'XZAG',isin:'TESTZSE'},{startDate:'2020-01-06',endDate:'2020-01-07'});
 assert.deepEqual(requested,['2020-01-06','2020-01-07']);
 assert.equal(result.bars.length,1);
 assert.equal(result.bars[0].date,'2020-01-07');
} finally {globalThis.fetch=original;}
console.log('Zagreb: absent archival trading day does not discard following valid prices OK');
