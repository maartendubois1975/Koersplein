import assert from 'node:assert/strict';
import {ZsePriceListProvider} from '../history/providers/zse-price-list.mjs';
const original=globalThis.fetch,controller=new AbortController();
let requests=0,aborted=0;
try{
 globalThis.fetch=async(url,{signal})=>{requests++;return new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>{aborted++;reject(signal.reason)},{once:true});});};
 const pending=new ZsePriceListProvider().fetchDaily({isin:'TEST',mic:'XZAG'},{startDate:'1997-01-01',endDate:'1997-12-31',signal:controller.signal});
 controller.abort(new Error('cancel-test'));
 await assert.rejects(pending,/cancel-test/);
 // The provider intentionally limits archive requests to three concurrent dates.\n assert.equal(requests,3);assert.equal(aborted,3);
 // A cancelled request must not cache an empty price list permanently.
 globalThis.fetch=async()=>new Response('isin,open_price,high_price,low_price,close_price,volume,trade_date\nTEST,10,12,9,11,100,1997-01-01\n');
 const retry=await new ZsePriceListProvider().fetchDaily({isin:'TEST',mic:'XZAG'},{startDate:'1997-01-01',endDate:'1997-01-01'});
 assert.equal(retry.bars.length,1);assert.equal(retry.bars[0].close,11);
}finally{globalThis.fetch=original;}
console.log('ZSE: cancellation stops historical batches; aborted requests remain retryable OK');
