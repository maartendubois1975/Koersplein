import { pathToFileURL } from 'node:url';
import { validSessionDate } from '../../daily-session-view.mjs';
import { inspectDailyBarIntegrity } from '../cloudflare/europe-run-policy.mjs';
import { operationsReport } from './operations-report.mjs';
import { providerRoute } from './source-policy.mjs';
import { createDefaultProviderRegistry } from './provider-registry.mjs';
import { identityEventAt } from './company-register.mjs';
import { marketSources } from './market-definitions.mjs';

export async function reviewHistoryGaps(market, company, range, provider, {
  registry = createDefaultProviderRegistry(), sources = marketSources,
} = {}) {
  const { startDate, endDate } = range;
  const elapsed = Date.parse(endDate) - Date.parse(startDate);
  if (!validSessionDate(startDate) || !validSessionDate(endDate) || elapsed < 0 ||
      elapsed > 92 * 86_400_000 || endDate > market.latestClosed) throw Error('INVALID_GAP_REVIEW_WINDOW');
  if (identityEventAt(company.isin, endDate)) throw Error('GAP_REVIEW_LISTING_IDENTITY_RETIRED');
  if (company.issues.length || !company.gapWindowStart || startDate < company.gapWindowStart) {
    throw Error('UNVERIFIED_STORED_HISTORY_OR_LISTING_WINDOW');
  }
  const withBar = new Set(company.unverifiedWithBar);
  const requested = new Set([...company.missing, ...company.unverified]
    .filter(date => date >= startDate && date <= endDate && !withBar.has(date)));
  if (!requested.size) return { candidates: [], unresolved: [] };
  const route = providerRoute({ mic: company.mic }, { sourceRegistry: sources });
  if (!route.allowedProviderIds.includes(provider)) throw Error('UNAPPROVED_GAP_SOURCE');
  const permission = sources.markets[market.mic]?.publication?.[provider];
  if (permission?.free !== true || permission.publicArchive !== true || permission.publicDisplay !== true ||
      !permission.evidenceUrl?.startsWith('https://')) throw Error('UNVERIFIED_GAP_SOURCE_RIGHTS');
  const dates = [...requested].sort();
  const request = { startDate: dates[0], endDate: dates.at(-1), verifyIdentity: true };
  const { result } = await registry.fetchDaily({
    isin: company.isin, officialIsin: company.isin, mic: company.mic,
    symbol: company.symbol, currency: company.currency,
  }, request, provider, { strictPreferred: true, allowedProviderIds: [provider], timeoutMs: 25000 });
  const meta = result.providerMeta;
  if (meta?.isin !== company.isin || meta.mic !== company.mic || meta.currency !== company.currency ||
      meta.priceBasis !== 'UNADJUSTED' || meta.partialHistory === true || !result.requestUrl?.startsWith('https://')) {
    throw Error('UNVERIFIED_GAP_SOURCE_IDENTITY_OR_PRICE_BASIS');
  }
  const checked = inspectDailyBarIntegrity(result, request);
  const found = checked.bars.filter(bar => requested.has(bar.date));
  for (const bar of found) requested.delete(bar.date);
  return { candidates: found.map(bar => ({ bar, provider, sourceUrl: result.requestUrl, priceBasis: meta.priceBasis })),
    unresolved: [...requested].sort(), conflicts: checked.conflicts.filter(row => requested.has(row.date)) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [mic, isin, startDate, endDate, provider] = process.argv.slice(2);
  const report = await operationsReport();
  const market = report.markets.find(row => row.mic === mic);
  const company = market?.companies.find(row => row.isin === isin);
  if (!company) throw Error('ONBEKENDE_GOEDGEKEURDE_NOTERING');
  const proposed = await reviewHistoryGaps(market, company, { startDate, endDate }, provider);
  console.log(JSON.stringify({ market: mic, isin, ...proposed }, null, 2));
}
