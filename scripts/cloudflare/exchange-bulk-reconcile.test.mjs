import assert from 'node:assert/strict';
import {normalizeBulkBars,reconcileBulkWithCatalog} from './exchange-bulk-reconcile.mjs';
const date='2026-10-21';
const input=[
 {code:'ABC',date,open:10,high:12,low:9,close:11,volume:500},
 {code:'BAD',date,open:10,high:9,low:8,close:11,volume:3},
 {code:'OLD',date:'2026-10-20',open:10,high:12,low:9,close:11,volume:2}
];
const result=normalizeBulkBars(input,{date});
assert.equal(result.bars.length,1);
assert.deepEqual(result.errors.map(x=>x.reason),['INVALID_OHLCV','WRONG_TRADING_DATE']);
const joined=reconcileBulkWithCatalog({
 catalog:[{isin:'FR0000000001',mic:'XPAR'},{isin:'FR0000000002',mic:'XPAR'}],
 providerListings:[{Code:'ABC',Isin:'FR0000000001'}],
 bulkBars:result.bars
});
assert.equal(joined.matched.length,1);
assert.equal(joined.matched[0].close,11);
assert.equal(joined.missing.length,1);
assert.equal(joined.missing[0].reason,'NO_ISIN_MATCH');
const malformed=normalizeBulkBars([
 {code:'NULL',date,open:null,high:12,low:9,close:11,volume:500},
 {code:'DUP',date,open:10,high:12,low:9,close:11,volume:500},
 {code:'DUP',date,open:10,high:12,low:9,close:11,volume:500},
 {code:'DUP',date,open:10,high:12,low:9,close:11,volume:500}
],{date});
assert.equal(malformed.bars.length,0);
assert.equal(malformed.errors.filter(x=>x.reason==='DUPLICATE_SYMBOL_DAY').length,2);
const sameIsin=reconcileBulkWithCatalog({
 catalog:[{isin:'FR0000000001',mic:'XPAR'},{isin:'FR0000000001',mic:'ALXP'}],
 providerListings:[{Code:'ABC',Isin:'FR0000000001'}],
 bulkBars:result.bars
});
assert.equal(sameIsin.matched.length,0);
assert.equal(sameIsin.ambiguous.length,2);
const conflicting=reconcileBulkWithCatalog({
 catalog:[{isin:'FR0000000001',mic:'XPAR'},{isin:'FR0000000002',mic:'XPAR'}],
 providerListings:[{Code:'ABC',Isin:'FR0000000001'},{Code:'ABC',Isin:'FR0000000002'}],
 bulkBars:result.bars
});
assert.equal(conflicting.matched.length,0);
assert.equal(conflicting.ambiguous.length,2);
const duplicateBars=reconcileBulkWithCatalog({
 catalog:[{isin:'FR0000000001',mic:'XPAR'}],
 providerListings:[{Code:'ABC',Isin:'FR0000000001'}],
 bulkBars:[result.bars[0],{...result.bars[0],close:10}]
});
assert.equal(duplicateBars.matched.length,0);
assert.equal(duplicateBars.ambiguous[0].reason,'MULTIPLE_BULK_BARS_FOR_CODE');
console.log('EXCHANGE_BULK_RECONCILE_TESTS_OK');
