import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { inspectDailyBarIntegrity } from '../cloudflare/europe-run-policy.mjs';

// Research comparison only. No output from this function authorizes price publication.
export function reconcileTradeDetails(audit, official) {
  const key = row => (row.mic || row.primaryMic) + ':' + row.isin;
  const tape = new Map(audit.listings.map(row => [key(row), row]));
  if (official.length !== audit.approved || new Set(official.map(key)).size !== official.length ||
      tape.size !== audit.listings.length || audit.unqualifiedRows ||
      audit.listings.some(row => !official.some(item => key(item) === key(row)))) throw Error('RECONCILIATION_IDENTITY_MISMATCH');
  const listings = official.map(share => {
    const bar = share.bar, trades = tape.get(key(share));
    if (bar && bar.date !== audit.session) throw Error('RECONCILIATION_SESSION_MISMATCH');
    const integrity = bar ? inspectDailyBarIntegrity({ bars: [bar] }, { startDate: audit.session, endDate: audit.session }) : null;
    const differences = [];
    if (trades && bar) {
      const expected = { open: trades.first?.price, high: trades.high, low: trades.low, close: trades.last?.price, volume: trades.totalVolume };
      for (const field of Object.keys(expected)) if (bar[field] !== expected[field]) differences.push(field);
    }
    const hasLast = Number.isFinite(bar?.lastTradePrice) && bar.lastTradePrice > 0;
    const lastMatches = trades && hasLast ? trades.lastCandidatePrices.includes(bar.lastTradePrice) : null;
    const executionMatches = lastMatches === true && !differences.some(field => field !== 'close') && !trades.modifications && !integrity.conflicts.length;
    return { isin: share.isin, mic: share.primaryMic, symbol: share.symbol, currency: share.currency,
      status: !trades ? (bar?.volume === 0 ? 'ZERO_VOLUME_WITHOUT_TAPE' : 'UNCONFIRMED') :
        !bar ? 'OFFICIAL_BAR_ABSENT' : trades.modifications ? 'TRADE_MODIFICATIONS_REQUIRE_REVIEW' :
        integrity.conflicts.length ? 'OFFICIAL_OHLC_INVALID' : differences.length ? 'DEFINITION_REVIEW' :
        trades.lastCandidatePrices.length > 1 ? 'MATCH_WITH_AMBIGUOUS_LAST_TRADE_ORDER' : 'EXACT_MATCH',
      lastTradeMatches: lastMatches, executionMatches,
      definitionStatus: !trades ? 'NO_EXECUTION_TO_COMPARE' : !hasLast ? 'OFFICIAL_LAST_NOT_OBSERVED' :
        !executionMatches ? 'SOURCE_CONFLICT' : bar.close !== bar.lastTradePrice ? 'OFFICIAL_REFERENCE_DISTINCT_FROM_LAST' : 'OFFICIAL_REFERENCE_EQUALS_LAST',
      differences, official: bar, trades: trades || null,
      volumeMatches: trades && bar ? bar.volume === trades.totalVolume : null,
      officialIntegrityIssues: integrity?.conflicts || [],
      exactFinalIntervalVwapMatch: trades?.finalIntervalVolume && bar ? trades.finalIntervalVwap === bar.close : null };
  });
  const statuses = {};
  for (const row of listings) statuses[row.status] = (statuses[row.status] || 0) + 1;
  return { session: audit.session, approved: audit.approved, observed: audit.observed,
    statuses, lastTradeMatches: listings.filter(row => row.lastTradeMatches).length,
    referenceCloseDifferences: listings.filter(row => row.definitionStatus === 'OFFICIAL_REFERENCE_DISTINCT_FROM_LAST').length,
    definitionUnresolved: listings.filter(row => row.trades && !row.executionMatches).length, volumeMatches: listings.filter(row => row.volumeMatches).length,
    volumeDifferences: listings.filter(row => row.volumeMatches === false).length,
    publicationApproved: false, listings };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [tape, official] = await Promise.all(process.argv.slice(2, 4).map(file => readFile(file, 'utf8').then(JSON.parse)));
  console.log(JSON.stringify(reconcileTradeDetails(tape, official), null, 2));
}
