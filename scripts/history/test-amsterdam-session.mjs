import { strict as assert } from 'node:assert';
import { mergeBars } from './engine.mjs';

const preliminary = [{ date: '2026-10-26', open: 100, high: 102, low: 99, close: 101, volume: 1000 }];
const officialClose = [{ date: '2026-10-26', open: 100, high: 105, low: 99, close: 104, volume: 2200 }];
const bars = mergeBars(preliminary, officialClose);
assert.equal(bars.length, 1, 'One trading day must have exactly one record');
assert.equal(bars[0].open, 100);
assert.equal(bars[0].close, 104);
assert.equal(bars[0].volume, 2200);
assert.equal(Number((((bars[0].close / bars[0].open) - 1) * 100).toFixed(2)), 4);
console.log('Amsterdam daily opening/closing merge regression: OK');
