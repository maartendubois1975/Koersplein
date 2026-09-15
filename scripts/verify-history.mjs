import { strict as assert } from 'node:assert';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { loadCatalog, readJson, runBatch, validateBars, historyUrl } from './history/engine.mjs';
import { buildChartModel, filterPeriod } from '../chart.js';

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
  const bars = document.bars;
  const uniqueDates = new Set(bars.map((bar) => bar.date));
  assert.equal(uniqueDates.size, bars.length, 'Handelsdatums moeten uniek zijn');
  assert.ok(bars.every((bar, index) => index === 0 || bars[index - 1].date < bar.date), 'Handelsdatums moeten strikt chronologisch zijn');
  for (const field of ['open', 'high', 'low', 'close']) {
    assert.ok(bars.every((bar) => Number.isFinite(bar[field]) && bar[field] >= 0), `${field} mag niet negatief, null of NaN zijn`);
  }
  assert.ok(bars.every((bar) => bar.close > 0 && bar.high >= bar.low), 'Close en high/low-verhouding moeten geldig zijn');
  const periods = {};
  for (const period of ['1J', '3J', '5J', '10J', 'MAX']) {
    const visible = filterPeriod(bars, period);
    const chart = buildChartModel(bars, period);
    assert.ok(visible.length > 1, `${period} moet koerspunten bevatten`);
    assert.equal(visible.at(-1).date, document.coverage.lastDate, `${period} moet eindigen op de laatste handelsdag`);
    assert.ok(chart.minimum >= 0, `${period} mag bij uitsluitend positieve koersen geen negatieve Y-as hebben`);
    periods[period] = { records: visible.length, firstDate: visible[0].date, lastDate: visible.at(-1).date, axisMinimum: chart.minimum };
  }
  instruments[instrument.isin] = {
    isin: instrument.isin,
    symbol: instrument.symbol,
    name: instrument.name,
    mic: instrument.mic,
    file: `${instrument.isin}.json`,
    coverage: document.coverage,
    provider: { id: document.provider.id, name: document.provider.name, technicalTestSource: true }
  };
  console.log(JSON.stringify({ pass: 'audit', isin: instrument.isin, records: bars.length, firstDate: bars[0].date, lastDate: bars.at(-1).date, duplicates: 0, invalid: 0, negativeOhlc: 0, nullOrNaNOhlc: 0, periods }));
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
