import assert from 'node:assert/strict';
import { mergeBars, partitionBars, encodePartition, decodePartition, objectKey, STORAGE_FORMAT } from './history-format.mjs';

const bars = mergeBars(
  [{ date: '2025-12-31', open: 9, high: 11, low: 8, close: 10, volume: null }],
  [{ date: '2025-12-31', open: 10, high: 12, low: 9, close: 11, volume: 20 }, { date: '2026-01-02', open: 11, high: 13, low: 10, close: 12 }]
);
assert.equal(bars.length, 2); assert.equal(bars[0].close, 11); assert.deepEqual([...partitionBars(bars).keys()], ['2025', '2026']);
assert.deepEqual(decodePartition(encodePartition(bars)), bars);
assert.equal(objectKey({ mic: 'XAMS', isin: 'NL0010273215', period: '2026' }), 'history/v1/mic=XAMS/isin=NL0010273215/year=2026/prices.ndjson.gz');
assert.equal(STORAGE_FORMAT, 'ndjson+gzip-v1');
await import('../../cloudflare/worker.mjs');
console.log('Cloudflare-opslagformaat en Worker-syntax: OK');
