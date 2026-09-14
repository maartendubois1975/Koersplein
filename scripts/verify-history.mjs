import { strict as assert } from 'node:assert';
import { loadCatalog, runBatch } from './history/engine.mjs';

const expected = new Set(['NL0010273215', 'NL0012969182']);
const catalog = (await loadCatalog()).filter((item) => expected.has(item.isin));
assert.equal(catalog.length, 2, 'ASML en Adyen moeten beide gekoppeld zijn.');

const first = await runBatch(catalog, { mode: 'backfill', batchSize: 2 });
for (const result of first) {
  assert.notEqual(result.outcome, 'error');
  console.log(JSON.stringify({ pass: 'backfill', ...result }));
}

const second = await runBatch(catalog, { mode: 'update', batchSize: 2 });
for (const result of second) {
  assert.equal(result.outcome, 'unchanged', `Rerun voor ${result.isin} moet unchanged zijn`);
  console.log(JSON.stringify({ pass: 'rerun', ...result }));
}

console.log('ASML/Adyen backfill en onmiddellijke idempotente rerun: OK.');
