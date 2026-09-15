import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { computeMovers, mergeBars, validateBars } from './history/engine.mjs';
import { buildChartModel, downsampleSeries, filterPeriod, validateHistoryDocument } from '../chart.js';

const original = [{ date: '2026-09-10', open: 100, high: 103, low: 99, close: 102, adjustedClose: 102, volume: null }];
const incoming = [
  { date: '2026-09-10', open: 100, high: 103, low: 99, close: 102, adjustedClose: 102, volume: 20 },
  { date: '2026-09-11', open: 102, high: 106, low: 101, close: 105, adjustedClose: 105, volume: null },
  { date: 'ongeldig', close: -1 }
];
const once = mergeBars(original, incoming);
const twice = mergeBars(once, incoming);
assert.equal(once.length, 2);
assert.deepEqual(twice, once, 'Rerun moet idempotent zijn');
assert.equal(once[0].volume, 20, 'Een later beschikbaar volume mag worden aangevuld');
assert.equal(validateBars([{ date: '2026-09-10', high: 1, low: 2, close: 1.5 }]).length, 0);

const movers = computeMovers([{ instrument: { isin: 'NL0010273215', name: 'ASML HOLDING', symbol: 'ASML', market: 'Euronext Amsterdam', mic: 'XAMS', country: 'Nederland' }, provider: 'fixture', bars: once }]);
assert.equal(movers.length, 1);
assert.ok(Math.abs(movers[0].changePercent - 2.941176470588225) < 1e-9);
assert.equal(movers[0].tradingDate, '2026-09-11');

const [html, app, detail, contracts, detailScript, chartScript, css] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../app.js', import.meta.url), 'utf8'),
  readFile(new URL('../share.html', import.meta.url), 'utf8'),
  readFile(new URL('../data/home-contracts.json', import.meta.url), 'utf8'),
  readFile(new URL('../share.js', import.meta.url), 'utf8'),
  readFile(new URL('../chart.js', import.meta.url), 'utf8'),
  readFile(new URL('../styles.css', import.meta.url), 'utf8')
]);
for (const text of ['3 maanden', '6 maanden', '12 maanden', '24 maanden', '+10%', '+20%', '+30%']) assert.ok(html.includes(text));
assert.ok(html.includes('selectie-engine') && html.includes('geen rendementsbelofte'));
assert.ok(html.includes('Stijgers gisteren') && html.includes('Dalers gisteren'));
assert.ok(app.includes('share.html?isin=') && app.includes('share.name, share.symbol, share.isin'));
assert.ok(detail.includes('Koersplein-analyse'));
assert.ok(detail.includes('Kans- en risicoanalyse wordt beschikbaar') && !detail.includes('model-contract'));
assert.ok(detail.includes('history-state') && detailScript.includes('manifest.json') && detailScript.includes('renderHistoryChart'));
assert.ok(!detailScript.includes('catch { /*'), 'Historiefouten mogen niet stil worden ingeslikt');
assert.ok(css.includes('@media(max-width:640px)') && css.includes('.chart-shell svg{height:220px}'));

const synthetic = Array.from({ length: 7241 }, (_, index) => {
  const date = new Date(Date.UTC(1998, 6, 20) + index * 1.42 * 86_400_000).toISOString().slice(0, 10);
  return { date, open: 100 + index / 20, high: 102 + index / 20, low: 99 + index / 20, close: 101 + index / 20, adjustedClose: 101 + index / 20, volume: null };
});
const chartModel = buildChartModel(synthetic, 'MAX');
assert.equal(chartModel.filtered.length, 7241);
assert.ok(chartModel.plotted.length <= 902 && chartModel.path.startsWith('M'));
assert.ok(filterPeriod(synthetic, '1J').length < synthetic.length);
assert.ok(downsampleSeries(synthetic).length < synthetic.length);
const positiveWideRange = [
  { date: '1998-07-20', close: 1.77 },
  { date: '2026-09-11', close: 1721.4 }
];
const positiveModel = buildChartModel(positiveWideRange, 'MAX');
assert.equal(positiveModel.minimum, 0, 'Positieve koersreeksen mogen door padding niet onder nul schalen');
assert.equal(positiveModel.dataMinimum, 1.77);
assert.ok(chartScript.includes("show(model.filtered.at(-1), 'latest')"));
assert.ok(chartScript.includes("container.dataset.selectedDate = bar.date"));
assert.ok(chartScript.includes("if (activePointer === null)"), 'Pointerfocus mag een gekozen touchpunt niet overschrijven');
assert.ok(chartScript.includes("overlay.addEventListener('click'"), 'Tap/click moet het dichtstbijzijnde handelsmoment vasthouden');
const fixtureDocument = { schemaVersion: 1, instrument: { isin: 'NL0010273215', symbol: 'ASML', mic: 'XAMS' }, coverage: { records: 2, firstDate: once[0].date, lastDate: once[1].date }, bars: once };
assert.equal(validateHistoryDocument(fixtureDocument, { isin: 'NL0010273215', symbol: 'ASML' }).length, 2);
const parsedContracts = JSON.parse(contracts);
assert.equal(parsedContracts.opportunitySelection.status, 'engine_unavailable');
assert.equal(parsedContracts.dailyMovers.status, 'dataset_unavailable');
console.log('UI-contracten, grafiek/MAX, responsive CSS, historievalidatie, idempotentie, foutfilter en moversberekening: OK.');
