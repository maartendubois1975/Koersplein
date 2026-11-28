import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';
import { collectApprovedSession } from '../cloudflare/approved-daily-session.mjs';
import { archiveApprovedSessions } from '../cloudflare/archive-approved-session.mjs';
import { publishTestHistory } from './publish-test-history.mjs';
import { validateCompanyCatalog } from './company-register.mjs';
import { corroboratedEuronextNoTrade } from './providers/euronext-live.mjs';

const read = file => fs.readFile(file, 'utf8').then(JSON.parse);
const catalog = await read('research/milan/2026-11-26/approved-companies.json');
const contract = (await read('data/company-register-contracts.json')).catalogPreviews.XMIL;
validateCompanyCatalog(catalog, contract);
const prices = await read('research/completion/2026-11-27/milan-price-definitions.json');
const quotes = await read('research/admission/2026-11-27/milan-no-trade-evidence.json');
const now = new Date('2026-11-27T06:30:00Z');
const byIsin = new Map(prices.listings.map(row => [row.isin, row]));
const noTrades = new Map(quotes.map(row => [row.isin, row]));
const sourceRegistry = { markets: { XMIL: { status: 'APPROVED', officialDailyProvider: 'euronext-live',
  dailySources: [{ provider: 'euronext-live', role: 'PRIMARY' }] } } };
// Temporary dependency injection tests technical wiring. It grants no publication permission.
const options = { market: 'XMIL', session: prices.session, now, catalog, sourceRegistry,
  registry: { fetchDaily() { throw Error('No network or fallback permitted in source replay'); } },
  official: async item => {
    const row = byIsin.get(item.isin);
    assert.equal(row.mic, item.mic); assert.equal(row.currency, item.currency);
    const sourceUrl = 'https://live.euronext.com/en/ajax/getHistoricalPricePopup/' + item.isin + '-' + item.mic;
    if (row.trades) return { status: 'TRADED', date: prices.session, provider: 'euronext-live', sourceUrl,
      bar: Object.fromEntries(['date', 'open', 'high', 'low', 'close', 'volume'].map(field => [field, row.official[field]])) };
    const proof = noTrades.get(item.isin);
    assert(corroboratedEuronextNoTrade(proof.quote, row.official, prices.session, proof.observedAt));
    return { status: 'NO_TRADES', date: prices.session, provider: 'euronext-live', sourceUrl,
      verification: 'OFFICIAL_ZERO_VOLUME_AND_PRIOR_LAST_TRADE', lastTradeDate: proof.quote.lastTradeDate };
  } };
const snapshot = await collectApprovedSession(options);
assert.deepEqual(snapshot.counts, { NO_TRADES: 51, TRADED: 309 });
const root = await fs.mkdtemp(join(os.tmpdir(), 'milan-source-chain-'));
try {
  const inputDir = join(root, 'input'), dataDir = join(root, 'data'), historyDir = join(dataDir, 'history');
  await fs.mkdir(inputDir); await fs.mkdir(historyDir, { recursive: true });
  const prior = await read('research/admission/2026-11-27/abtg-confirmed-prior-session.json');
  await fs.writeFile(join(historyDir, 'EXGM:' + prior.instrument.isin + '.json'), JSON.stringify({
    schemaVersion: 1, instrument: prior.instrument, provider: { name: 'euronext-live', metadata: { backfillComplete: false } },
    coverage: { firstDate: prior.bar.date, lastDate: prior.bar.date, recordCount: 1, records: 1 }, bars: [prior.bar] }));
  await fs.writeFile(join(inputDir, 'daily-session-XMIL.json'), JSON.stringify(snapshot));
  const archiving = { inputDir, dataDir, markets: ['XMIL'], loadCatalog: async () => catalog };
  const archived = await archiveApprovedSessions(archiving);
  assert.deepEqual(archived.errors, []); assert.deepEqual(archived.conflicts, []);
  const file = join(dataDir, 'daily-session-XMIL.json');
  const saved = await fs.readFile(file, 'utf8');
  const last = JSON.parse(saved).results.find(row => row.isin === prior.instrument.isin);
  assert.equal(last.status, 'NO_TRADES'); assert.deepEqual(last.lastConfirmedBar, prior.bar);
  assert.equal(last.lastConfirmedBar.date, '2026-11-25');
  await archiveApprovedSessions(archiving);
  assert.equal(await fs.readFile(file, 'utf8'), saved);
  const published = await publishTestHistory({ markets: [{ ...catalog, canonicalHistoryOnly: true }], historyDir,
    outputDir: join(root, 'public'), now, fetchImpl: () => { throw Error('No external service permitted in publication replay'); } });
  assert.equal(published.XMIL, 310);
  const publicPrior = await read(join(root, 'public', 'EXGM:' + prior.instrument.isin + '.json'));
  assert.deepEqual(publicPrior.bars, [prior.bar]);
  const nodes = new Map(), testContracts = await read('data/company-register-contracts.json');
  assert.equal(testContracts.markets.XMIL, undefined);
  testContracts.markets.XMIL = testContracts.catalogPreviews.XMIL;
  globalThis.document = { querySelector(selector) {
    if (!nodes.has(selector)) nodes.set(selector, { value: '', textContent: '', innerHTML: '', addEventListener() {} });
    return nodes.get(selector);
  } };
  globalThis.location = { search: '?market=milan' };
  globalThis.fetch = async url => {
    assert(!url.startsWith('https:'), 'Renderer must not contact another service');
    const value = url === 'data/company-register-contracts.json' ? testContracts :
      url === 'data/daily-session-XMIL.json' ? JSON.parse(saved) : await read(url);
    return { ok: true, json: async () => value };
  };
  await import('../../generic-market.js?milan-source-chain');
  for (let attempt = 0; attempt < 200 && !nodes.get('#market-meta')?.textContent.includes('bevestigde koersen'); attempt++) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  const html = nodes.get('#share-groups').innerHTML;
  assert.equal((html.match(/class="share-link"/g) || []).length, 360);
  assert(nodes.get('#market-meta').textContent.includes('309/360 bevestigde koersen'));
  const abtg = html.match(/<tr>[^]*?<\/tr>/g).find(row => row.includes('symbol=ABTG'));
  assert(abtg.includes('2026-11-25')); assert(abtg.includes('laatst bevestigd slot'));
  const { auditStoredForecastInput } = await import('../research/forecast-input-review.mjs');
  const review = await auditStoredForecastInput(catalog.shares.find(share => share.symbol === 'A2A'), 'XMIL',
    { dataDir, cutoff: prices.session, currency: 'EUR' });
  assert.equal(review.status, 'PROVENANCE_UNVERIFIED'); assert.equal(review.storedWindowStatus, 'INSUFFICIENT_HISTORY');
  assert.equal((await read('data/company-register-contracts.json')).markets.XMIL, undefined);
} finally { await fs.rm(root, { recursive: true, force: true }); }
console.log('Milan full 360-company source→session→archive→chart replay, 309 traded/51 no-trade, dated prior close and idempotency PASS; research only');
