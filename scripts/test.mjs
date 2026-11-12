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

const [html, detail, contracts, detailScript, chartScript, css] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../share.html', import.meta.url), 'utf8'),
  readFile(new URL('../data/home-contracts.json', import.meta.url), 'utf8'),
  readFile(new URL('../share.js', import.meta.url), 'utf8'),
  readFile(new URL('../chart.js', import.meta.url), 'utf8'),
  readFile(new URL('../styles.css', import.meta.url), 'utf8')
]);
for(const [page,code] of Object.entries({"brussel.html":"brussels","parijs.html":"paris","milaan.html":"milan","oslo.html":"oslo","lissabon.html":"lisbon","zurich.html":"zurich","stockholm.html":"stockholm"})) {
 const html=await readFile(new URL('../'+page,import.meta.url),'utf8');
 assert.ok(html.includes('market.html?market='+code)&&!html.includes('src="market.js'),page+' must redirect to shared renderer');
}
await assert.rejects(readFile(new URL('../market.js',import.meta.url),'utf8'),{code:'ENOENT'},'Unused legacy market renderer must be deleted');
const weekPage = await readFile(new URL('../amsterdam.html', import.meta.url), 'utf8');
const marketScript = await readFile(new URL('../generic-market.js', import.meta.url), 'utf8');
const weekCore = await readFile(new URL('../market-week-core.mjs', import.meta.url), 'utf8');
assert.ok(html.includes('Openings- en slotkoersen') && html.includes('market.html?market=amsterdam'), 'Homepage must focus on open and close');
assert.ok(html.includes('home-markets.js') && !html.includes('top5-markets.js') && !html.includes('opportunity-form'), 'Homepage must not run prediction or ranking engines');
assert.ok(weekPage.includes('market.html?market=amsterdam') && !weekPage.includes('amsterdam-week.js'), 'Amsterdam must expose the five-session table');
assert.ok(marketScript.includes('collectMarketWeek') && marketScript.includes('sessionChange') && weekCore.includes('manifestResolver'), 'Amsterdam must use MIC-safe canonical history and calculate daily changes');
assert.ok(detail.includes('Dagelijkse koersgegevens') && !detail.includes('Kans- en risicoanalyse'));
assert.ok(detail.includes('Opening, slot en verloop') && !detail.includes('model-contract'));
assert.ok(detail.includes('history-state') && detailScript.includes('/api/history/') && detailScript.includes('runtime.apiBaseUrl') && detailScript.includes('renderHistoryChart'));
assert.ok(!detailScript.includes('catch { /*'), 'Historiefouten mogen niet stil worden ingeslikt');
assert.ok(css.includes('@media(max-width:640px)') && css.includes('.chart-shell svg{height:220px}'));

const micHistory={schemaVersion:1,instrument:{isin:'XAMS:NL111',symbol:'AAA',mic:'XAMS'},coverage:{records:1,firstDate:'2026-10-23',lastDate:'2026-10-23'},bars:[{date:'2026-10-23',open:100,high:110,low:95,close:105,volume:100}]};
assert.equal(validateHistoryDocument(micHistory,{isin:'XAMS:NL111',symbol:'AAA',mic:'XAMS'}).length,1,'MIC-scoped storage key should render');
assert.throws(()=>validateHistoryDocument(micHistory,{isin:'XBRU:NL111',symbol:'AAA',mic:'XBRU'}),/Historie-identiteit wijkt af/,'Cross-listed venue must not inherit another exchange candle');

const synthetic = Array.from({ length: 7241 }, (_, index) => {
  const date = new Date(Date.UTC(1998, 6, 20) + index * 1.42 * 86_400_000).toISOString().slice(0, 10);
  return { date, open: 100 + index / 20, high: 102 + index / 20, low: 99 + index / 20, close: 101 + index / 20, adjustedClose: 101 + index / 20, volume: null };
});
const chartModel = buildChartModel(synthetic, 'MAX');
assert.equal(chartModel.filtered.length, 7241);
assert.ok(chartModel.plotted.length <= 902 && chartModel.path.startsWith('M'));
assert.ok(filterPeriod(synthetic, '1J').length < synthetic.length);
assert.ok(filterPeriod(synthetic, '3J').length < synthetic.length);
assert.ok(filterPeriod(synthetic, '5J').length < synthetic.length);
assert.ok(filterPeriod(synthetic, '10J').length < synthetic.length);
assert.equal(filterPeriod(synthetic, 'MAX').length, synthetic.length);