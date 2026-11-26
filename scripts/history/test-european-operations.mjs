import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { operationsReport } from './operations-report.mjs';
import { catalogDrift } from './catalog-drift.mjs';
import { reviewHistoryGaps } from './history-gap-review.mjs';
import { assertOperationalMarket } from './market-definitions.mjs';
import { loadCompanyCatalog } from './company-register.mjs';
import { collectApprovedSession } from '../cloudflare/approved-daily-session.mjs';
import { verifyOpportunity, sealOpportunity, evaluateBenchmark, opportunityScoreboard } from '../research/prediction-ledger-core.mjs';

const read = file => fs.readFile(file, 'utf8').then(JSON.parse);
const archived = await read('data/daily-session-XBRU.json');
const now = new Date(archived.session + 'T21:00:00Z');
const report = await operationsReport({ now });
assert.equal(report.markets.reduce((count, market) => count + market.approvedCompanies, 0), 899);
const market = report.markets.find(row => row.mic === 'XBRU');
assert.equal(market.latestPublished, archived.session);
assert.deepEqual(market.counts, archived.counts);
for (const row of archived.results) {
  const company = market.companies.find(item => item.isin === row.isin);
  assert(company);
  if (row.status === 'NO_TRADES') assert(company.noTrades.includes(archived.session));
  if (row.status === 'SESSION_UNVERIFIED') assert(company.unverified.includes(archived.session));
}
assert.equal(report.predictions.savedRecords, (await read('data/opportunity-ledger.json')).length);

const catalog = await loadCompanyCatalog('XBRU');
const tested = [];
const retry = await collectApprovedSession({
  market: catalog.mic, catalog, session: archived.session, now, priorSnapshot: archived,
  official: async item => { tested.push(item.isin); return null; },
  registry: { async fetchDaily() { throw Error('Regression source unavailable'); } },
});
assert.deepEqual(tested.sort(), archived.results.filter(row => row.status === 'SESSION_UNVERIFIED').map(row => row.isin).sort());
for (const row of archived.results.filter(row => row.status !== 'SESSION_UNVERIFIED')) {
  assert.deepEqual(retry.results.find(current => current.isin === row.isin), row);
}

const milan = await read('research/milan/2026-11-26/approved-companies.json');
assert.throws(() => assertOperationalMarket(milan, { navigation: { name: 'Milaan', code: 'milan', country: 'IT', currency: 'EUR' } }), /SOURCE_ROUTES/);
const picked = milan.shares.find(row => row.symbol === 'MFEB');
const rawList = {
  mic: milan.mic, asOf: '2026-11-26', sourceUrl: 'https://live.euronext.com/en/markets/milan/equities/list',
  shares: [{ ...picked, issuerId: 'MFE' }, { ...picked, issuerId: 'MFE' },
    { ...picked, issuerId: 'MFE', isin: 'NL0015001OI1', symbol: 'MFEA' }],
};
const drift = catalogDrift(milan, rawList);
assert.equal(drift.duplicateIsins[0].id, picked.isin);
assert.equal(drift.multipleClasses[0].id, 'MFE');
assert.equal(drift.newListings.length, 1);
assert.equal(drift.missingListings.length, 359);
assert.equal(milan.shares.length, 360);

const xams = report.markets.find(row => row.mic === 'XAMS');
const actual = await read('data/history/XAMS:NL0010273215.json');
const observation = actual.bars.at(-1);
const company = {
  ...xams.companies.find(row => row.symbol === 'ASML'), issues: [],
  missing: [observation.date], unverified: [],
};
const window = { startDate: observation.date, endDate: observation.date };
await assert.rejects(() => reviewHistoryGaps({ ...xams, latestClosed: observation.date }, company,
  window, 'yahoo-chart'), /UNVERIFIED_GAP_SOURCE_RIGHTS/);
const fakeRegistry = { async fetchDaily() { return { result: { bars: [observation],
  requestUrl: 'https://live.euronext.com/en/ajax/getHistoricalPricePopup/NL0010273215-XAMS',
  providerMeta: { isin: company.isin, mic: 'XAMS', currency: 'EUR', priceBasis: 'UNADJUSTED' },
} }; } };
const permission = { markets: { XAMS: { status: 'APPROVED', historySources: [{ role: 'PRIMARY', provider: 'fixture' }],
  publication: { fixture: { free: true, publicArchive: true, publicDisplay: true,
    evidenceUrl: 'https://live.euronext.com' } },
} } };
const proposed = await reviewHistoryGaps({ ...xams, latestClosed: observation.date }, company, window,
  'fixture', { registry: fakeRegistry, sources: permission });
assert.deepEqual(proposed.candidates.map(row => row.bar), [observation]);
assert.deepEqual(proposed.unresolved, []);

const other = await read('data/history/XAMS:NL0012969182.json');
const otherReference = other.bars.find(row => row.date === actual.bars[0].date);
const otherLast = other.bars.find(row => row.date === observation.date);
assert(otherReference && otherLast);
const reference = actual.bars[0];
const prediction = sealOpportunity({ market: 'XAMS', isin: company.isin, referenceDate: reference.date,
  referenceClose: reference.close, targetPct: 30, signalType: 'consensus', horizonMonths: 3,
  benchmarkAtSelection: [{ isin: company.isin, referenceClose: reference.close },
    { isin: other.instrument.isin, referenceClose: otherReference.close }],
});
const changed = structuredClone(prediction);
changed.benchmarkAtSelection.pop();
assert.throws(() => verifyOpportunity(changed), /FROZEN_OPPORTUNITY_CHANGED/);
const outcome = { status: 'CLOSED', latestDate: observation.date, currentReturn: observation.close / reference.close - 1, result30: false };
const benchmark = await evaluateBenchmark(prediction, outcome,
  async member => member.isin === company.isin ? actual.bars : other.bars);
assert.equal(benchmark, (outcome.currentReturn + (otherLast.close / otherReference.close - 1)) / 2);
assert.equal(await evaluateBenchmark(prediction, outcome, async member => member.isin === company.isin ? actual.bars : []), null);
const scores = opportunityScoreboard([{ ...prediction, ...outcome, benchmarkReturn: benchmark }]);
assert.equal(scores.byMarket.XAMS.closed, 1);
assert.equal(scores.bySignal.consensus.benchmarkComparisons, 1);
assert.equal(scores.byHorizon['3'].averageExcessReturn, outcome.currentReturn - benchmark);
console.log('European status, saved-session retry, catalog drift, source-bound gap review and sealed benchmark PASS');
