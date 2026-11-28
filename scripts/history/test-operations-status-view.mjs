import assert from 'node:assert/strict';
import { operationsReport } from './operations-report.mjs';
const report = await operationsReport();
class Element {
  constructor(tag = '') { this.tagName = tag; this.children = []; this.hidden = false; this.events = {}; this.value = ''; this.ownText = ''; }
  set textContent(value) { this.ownText = String(value); this.children = []; }
  get textContent() { return this.ownText + this.children.map(child => child.textContent).join(' '); }
  append(...nodes) { for (const node of nodes) this.children.push(...(node.tagName === '#fragment' ? node.children : [node])); }
  replaceChildren(...nodes) { this.children = []; this.ownText = ''; this.append(...nodes); }
  createTHead() { const node = new Element('thead'); this.append(node); return node; }
  createTBody() { const node = new Element('tbody'); this.append(node); return node; }
  insertRow() { const node = new Element('tr'); this.append(node); return node; }
  insertCell() { const node = new Element('td'); this.append(node); return node; }
  add(node) { this.append(node); }
  addEventListener(name, callback) { this.events[name] = callback; }
}
const nodes = new Map();
globalThis.HTMLElement = Element;
globalThis.Option = class extends Element { constructor(label, value) { super('option'); this.textContent = label; this.value = value; } };
globalThis.document = {
  getElementById(id) { if (!nodes.has(id)) nodes.set(id, new Element(id)); return nodes.get(id); },
  createElement: tag => new Element(tag), createDocumentFragment: () => new Element('#fragment'),
};
globalThis.fetch = async url => { assert.equal(url, '../data/operations-status.json'); return { ok: true, json: async () => report }; };
await import('../../status/operations-status.js?actual-status-view');
for (let attempt = 0; attempt < 100 && !nodes.get('scores')?.children.length; attempt++) await new Promise(resolve => setTimeout(resolve, 10));
assert(!nodes.get('build').textContent.includes('geen leesbaar'));
const rows = id => nodes.get(id).children[0].children.find(child => child.tagName === 'tbody').children;
assert.equal(rows('markets').length, 5);
assert.equal(rows('companies').length, 80);
assert(nodes.get('market-info').textContent.includes('Unieke complete OHLCV-dagen'));
assert(nodes.get('market-info').textContent.includes('herpublicatierechten nog niet vastgelegd'));
assert(nodes.get('previews').textContent.includes(report.previews[0].sourceReview.lastTradeMatches + ' laatste prijzen bevestigd'));
assert(nodes.get('previews').textContent.includes('Herpublicatierechten niet bewezen'));
assert(nodes.get('prediction-counts').textContent.includes(report.predictions.predictions + ' vooraf vastgelegde voorspellingen'));
assert.equal(rows('forecast-readiness').length, report.markets.filter(market => market.forecastReadiness).length);
assert.equal(rows('prediction-records').length, report.predictionRecords.length);
for (const row of report.predictionRecords) assert(nodes.get('prediction-records').textContent.includes(row.recordHash));
if (report.historyRecovery) assert(nodes.get('history-recovery').textContent.includes(String(report.historyRecovery.confirmedRestoredBars)));
nodes.get('exchange').value = 'XLIS'; nodes.get('exchange').events.change();
assert.equal(rows('companies').length, 34);
console.log('Actual status renderer: five markets, 80/34 company switch, source evidence, admission blockers and prediction tables PASS');
