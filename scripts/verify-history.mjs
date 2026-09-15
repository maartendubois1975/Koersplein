import { strict as assert } from 'node:assert';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { loadCatalog, readJson, runBatch, validateBars, historyUrl } from './history/engine.mjs';

const expected = new Set(['NL0010273215', 'NL0012969182']);
const catalog = (await loadCatalog()).filter((item) => expected.has(item.isin));
assert.equal(catalog.length, 2, 'ASML en Adyen moeten beide gekoppeld zijn.');

const first = await runBatch(catalog, { mode: 'backfill', batchSize: 2 });
for (const result of first) {
  assert.notEqual(result.outcome, 'error');
  assert.ok(['updated', 'unchanged'].includes(result.outcome));
  if (result.outcome === 'unchanged') assert.equal(result.providerRequest, false, 'Een bestaande complete backfill mag niet opnieuw downloaden');
  console.log(JSON.stringify({ pass: 'backfill', ...result }));
}

const second = await runBatch(catalog, { mode: 'backfill', batchSize: 2 });
for (const result of second) {
  assert.equal(result.outcome, 'unchanged', `Rerun voor ${result.isin} moet unchanged zijn`);
  assert.equal(result.providerRequest, false, `Rerun voor ${result.isin} mag niet opnieuw downloaden`);
  assert.equal(result.reason, 'backfill-complete');
  console.log(JSON.stringify({ pass: 'rerun', ...result }));
}

const instrumentFiles = (await readdir(historyUrl)).filter((name) => /^[A-Z]{2}[A-Z0-9]{10}\.json$/.test(name)).sort();
assert.deepEqual(instrumentFiles, [...expected].map((isin) => `${isin}.json`).sort(), 'Alleen ASML en Adyen mogen historische instrumentbestanden hebben');

const instruments = {};
for (const instrument of catalog) {
  const document = await readJson(new URL(`${instrument.isin}.json`, historyUrl));
  assert.equal(document.instrument.isin, instrument.isin);
  assert.equal(document.instrument.symbol, instrument.symbol);
  assert.equal(document.instrument.mic, 'XAMS');
  assert.equal(document.coverage.records, document.bars.length);
  assert.equal(document.coverage.firstDate, document.bars[0].date);
  assert.equal(document.coverage.lastDate, document.bars.at(-1).date);
  assert.equal(document.coverage.backfillComplete, true);
  assert.equal(validateBars(document.bars).length, document.bars.length, 'Alle records moeten geldig, uniek en chronologisch zijn');
  instruments[instrument.isin] = {
    isin: instrument.isin,
    symbol: instrument.symbol,
    name: instrument.name,
    mic: instrument.mic,
    file: `${instrument.isin}.json`,
    coverage: document.coverage,
    provider: { id: document.provider.id, name: document.provider.name, technicalTestSource: true }
  };
  console.log(JSON.stringify({ pass: 'audit', isin: instrument.isin, records: document.bars.length, firstDate: document.bars[0].date, lastDate: document.bars.at(-1).date, duplicates: 0, invalid: 0 }));
}

await mkdir(historyUrl, { recursive: true });
await writeFile(new URL('manifest.json', historyUrl), `${JSON.stringify({
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  scope: 'golden-test-cases-only',
  instruments
}, null, 2)}\n`);
const manifest = await readJson(new URL('manifest.json', historyUrl));
assert.deepEqual(Object.keys(manifest.instruments).sort(), [...expected].sort());
console.log('Publiek historie-manifest gecontroleerd: ASML + Adyen, geen derde aandeel.');
console.log('ASML/Adyen backfill, data-audit en echte idempotente no-op-rerun: OK.');
