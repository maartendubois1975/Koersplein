import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { loadCompanyCatalog } from '../history/company-register.mjs';
import { loadApprovedHistory } from './market-history-source.mjs';
import { proposeForecastReview } from './forecast-source-audit.mjs';
const root = 'research/completion/2026-11-27/';
const evidence = JSON.parse(gunzipSync(await fs.readFile(root + 'forecast-source-evidence.json.gz')));
const decisions = JSON.parse(await fs.readFile(root + 'forecast-admission-decisions.json', 'utf8'));
const catalog = await loadCompanyCatalog('XAMS');
const proposals = new Map();
for (const input of evidence) {
  const share = catalog.shares.find(row => row.isin === input.instrument.isin);
  const latest = JSON.parse(await fs.readFile('data/history/XAMS:' + share.isin + '.json', 'utf8')).coverage.lastDate;
  const bars = (await loadApprovedHistory(share, 'XAMS', { cutoff: latest })).filter(row => row.date <= input.cutoff);
  const before = JSON.stringify(bars);
  const result = proposeForecastReview(bars, input);
  assert.equal(JSON.stringify(bars), before);
  proposals.set(share.isin, { result, input, bars });
}
assert.equal(decisions.decisions.length, 16);
for (const decision of decisions.decisions) {
  const { result } = proposals.get(decision.key.split(':')[1]);
  assert.equal(result.status, 'REVIEW_PROPOSAL');
  assert.equal(result.proposal.officialWindowSha256, decision.officialWindowSha256);
}
const { input, bars } = proposals.get(decisions.decisions[0].key.split(':')[1]);
const wrong = structuredClone(input); wrong.quote.currency = 'USD';
assert(proposeForecastReview(bars, wrong).issues.includes('INSTRUMENT_OR_CURRENCY_MISMATCH'));
const action = structuredClone(input);
action.notices.events[0] = evidence.find(row => row.instrument.symbol === 'AMG').notices.events.find(event => event.type === 'CE - Shares - Capital increase');
assert(proposeForecastReview(bars, action).issues.includes('CORPORATE_ACTION_REQUIRES_INDIVIDUAL_REVIEW'));
const truncated = structuredClone(input); truncated.notices.total += 1;
assert(proposeForecastReview(bars, truncated).issues.includes('CORPORATE_ACTION_NOTICE_WINDOW_INCOMPLETE'));
const changed = structuredClone(input); changed.adjustedRows[0].close = changed.adjustedRows[0].high;
assert(proposeForecastReview(bars, changed).issues.includes('ADJUSTED_SOURCE_DIFFERENCE'));
const ledger = JSON.parse(await fs.readFile('data/opportunity-ledger.json', 'utf8'));
const first = ledger.find(row => row.recordHash === 'b1bc97fd10aa67a6739ecb581d08e33fb319a0a7da658c6ff075e319c03b1aae');
assert.equal(first.audit.eligibleCount, 2); assert.equal(first.benchmarkAtSelection.length, 2);
console.log('16 reviewed proposals, corporate-action/identity/adjustment/truncation rejection and original two-member benchmark preserved PASS');
