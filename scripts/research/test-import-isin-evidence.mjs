import assert from 'node:assert/strict';
import {parseSourceCsv} from './import-isin-evidence.mjs';
const meta={sourceUrl:'https://example.org/official',sourceDate:'2026-10-16',sourceDocument:'Official exchange file'};
const records=parseSourceCsv('symbol;isin\nEEE;CH0198251305\n',meta);
assert.equal(records.length,1);assert.equal(records[0].symbol,'EEE');assert.equal(records[0].isin,'CH0198251305');
assert.throws(()=>parseSourceCsv('ticker,isin\nEEE,CH0198251305',meta));
assert.throws(()=>parseSourceCsv('symbol,isin\nEEE,CH0198251305',{}));
console.log('Bulk ISIN source CSV tests passed');
