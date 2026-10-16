import assert from 'node:assert/strict';
import { cloudflareCatalog } from './catalog.mjs';
import { compareCloudflareCoverage } from './audit-live.mjs';
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

const catalog = await cloudflareCatalog();
assert.equal(catalog.markets.length,31);
assert.equal(catalog.unresolved.length,542);
assert.ok(catalog.instruments.length > 6000);
assert.equal(new Set(catalog.instruments.map(x=>x.isin)).size,catalog.instruments.length);
assert.ok(catalog.instruments.every(x=>x.isin && x.mic));
assert.equal(catalog.markets.find(x=>x.mic==='XAMS').timezone,'Europe/Amsterdam');
console.log('31 Europese markten en ISIN-veilig Cloudflare catalogus: OK');

const sample = compareCloudflareCoverage({markets:[{mic:'XAMS'},{mic:'XWAR'}], instruments:[{isin:'NL0010273215',mic:'XAMS'},{isin:'NL0012969182',mic:'XAMS'}],unresolved:[{mic:'XWAR',symbol:'ABC'}]}, {instruments:[{isin:'NL0010273215',mic:'XAMS'}]}, {instruments:{NL0010273215:{recordCount:200}}});
assert.deepEqual(sample.totals,{markets:2,expected:2,registered:1,withHistory:1,reportedBars:200});
assert.equal(sample.markets.find(x=>x.mic==='XAMS').missing[0],'NL0012969182');
assert.equal(sample.unresolvedWithoutIsin,1);
