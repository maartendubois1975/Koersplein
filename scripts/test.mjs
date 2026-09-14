import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { computeMovers, mergeBars, validateBars } from './history/engine.mjs';

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

const [html, app, detail, contracts] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../app.js', import.meta.url), 'utf8'),
  readFile(new URL('../share.html', import.meta.url), 'utf8'),
  readFile(new URL('../data/home-contracts.json', import.meta.url), 'utf8')
]);
for (const text of ['3 maanden', '6 maanden', '12 maanden', '24 maanden', '+10%', '+20%', '+30%']) assert.ok(html.includes(text));
assert.ok(html.includes('selectie-engine') && html.includes('geen rendementsbelofte'));
assert.ok(html.includes('Stijgers gisteren') && html.includes('Dalers gisteren'));
assert.ok(app.includes('share.html?isin=') && app.includes('share.name, share.symbol, share.isin'));
assert.ok(detail.includes('Koersplein-analyse'));
const parsedContracts = JSON.parse(contracts);
assert.equal(parsedContracts.opportunitySelection.status, 'engine_unavailable');
assert.equal(parsedContracts.dailyMovers.status, 'dataset_unavailable');
console.log('UI-contracten, historievalidatie, idempotentie, foutfilter en moversberekening: OK.');
