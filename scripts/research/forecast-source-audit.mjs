import { sameSourcePrice } from '../../chart.js';
import { forecastWindowHash, forecastLookback, reviewedForecastWindow } from './forecast-input-review.mjs';

const clean = html => html.replace(/<span[^>]*class="sr-only"[^>]*>[\s\S]*?<\/span>/g, '')
  .replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const iso = text => /^\d{2} [A-Z][a-z]{2} \d{4}$/.test(text) && Number.isFinite(Date.parse(text + ' 12:00:00 GMT'))
  ? new Date(text + ' 12:00:00 GMT').toISOString().slice(0, 10) : null;

export function parseForecastNotices(html) {
  const total = Number(html.match(/Showing\s+\d+-\d+\s+of\s+(\d+)/i)?.[1] ?? NaN);
  const events = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].flatMap(match => {
    const cell = name => clean(match[1].match(new RegExp('<td[^>]*class="' + name + '(?:[ "][^>]*)?[^>]*>([\\s\\S]*?)<\\/td>', 'i'))?.[1] || '');
    const id = cell('noticenumber');
    if (!id) return [];
    return [{ id, issued: cell('noticedate'), effective: cell('effect'), type: cell('noticename') }];
  });
  return { total: Number.isFinite(total) ? total : null, events };
}

export function parseForecastNoticePages(pages) {
  if (!pages.length) throw Error('NOTICE_PAGES_ABSENT');
  const parsed = pages.map(page => parseForecastNotices(page.html));
  if (parsed.some(row => row.total !== parsed[0].total)) throw Error('NOTICE_TOTAL_CHANGED_BETWEEN_PAGES');
  return { total: parsed[0].total, events: parsed.flatMap(row => row.events) };
}

// Read-only proposal. The approved review manifest is never written here.
export function proposeForecastReview(bars, { instrument, cutoff, rawRows, adjustedRows, quote, notices, source }, { priorReview } = {}) {
  const firstDate = bars.at(-forecastLookback)?.date;
  const selected = bars.slice(-forecastLookback);
  const official = rawRows.filter(row => row.date >= firstDate && row.date <= cutoff);
  const adjusted = adjustedRows.filter(row => row.date >= firstDate && row.date <= cutoff);
  const issues = [];
  if (!quote.identityMatch || quote.currency !== instrument.currency) issues.push('INSTRUMENT_OR_CURRENCY_MISMATCH');
  if (official.length !== forecastLookback || adjusted.length !== forecastLookback ||
      JSON.stringify(official.map(row => row.date)) !== JSON.stringify(selected.map(row => row.date))) issues.push('OFFICIAL_SESSION_WINDOW_INCOMPLETE');
  if (forecastWindowHash(official) !== forecastWindowHash(adjusted)) issues.push('ADJUSTED_SOURCE_DIFFERENCE');
  const windowCovered = notices.total === notices.events.length;
  if (!windowCovered || new Set(notices.events.map(event => event.id)).size !== notices.events.length) issues.push('CORPORATE_ACTION_NOTICE_WINDOW_INCOMPLETE');
  const events = notices.events.filter(event => !iso(event.effective) || iso(event.effective) >= firstDate && iso(event.effective) <= cutoff);
  // Capital decreases can cancel shares or alter nominal value. They need an individual decision.
  if (events.some(event => !iso(event.effective))) issues.push('CORPORATE_ACTION_EFFECTIVE_DATE_UNCONFIRMED');
  const allowedTypes = new Set(['CE - Shares - Dividend', 'CE - Shares - Ordinary dividend', 'CE - Shares - Shares buy-back', 'CE - Shares - Liquidity contract', 'CE - Shares - Dividend - Announcement', 'CE - Change of Index components', 'CE - Change of trading group', 'CE - Shares - Change of compartment', 'CE - Shares - Euronext Tech Leaders segment update']);
  const previouslyReviewed = event => priorReview?.corporateActions.events.some(old =>
    iso(event.effective) <= priorReview.asOf && JSON.stringify(old) === JSON.stringify(event));
  if (events.some(event => !allowedTypes.has(event.type) && !previouslyReviewed(event))) issues.push('CORPORATE_ACTION_REQUIRES_INDIVIDUAL_REVIEW');
  const resolutions = [], byDate = new Map(official.map(row => [row.date, row]));
  for (const base of selected) {
    const observed = byDate.get(base.date);
    if (!observed) continue;
    const fields = ['open', 'high', 'low', 'close', 'volume'].filter(field => field === 'volume'
      ? base[field] !== observed[field] : !sameSourcePrice(base[field], observed[field]));
    if (fields.some(field => !['high', 'low'].includes(field))) issues.push('OPEN_CLOSE_OR_VOLUME_CONFLICT');
    else if (fields.length) resolutions.push({ date: base.date, base, official: observed, fields, selection: 'OFFICIAL_UNADJUSTED' });
  }
  if (resolutions.length > 5) issues.push('MULTIPLE_SOURCE_CORRECTIONS_REQUIRE_INDIVIDUAL_REVIEW');
  const review = { instrument, asOf: cutoff, firstDate, records: forecastLookback, priceBasis: 'UNADJUSTED',
    rawWindowSha256: forecastWindowHash(selected), officialWindowSha256: forecastWindowHash(official),
    source: { ...source, adjusted: 'N', adjustmentComparison: 'N_EQUALS_Y' },
    corporateActions: { sourceUrl: source.url.replace('getHistoricalPricePopup/', 'getNoticePublicData/') + '?alias=1&pageNum=1&pageSize=50',
      sourceSha256: source.noticeSha256, review: 'NO_SPLIT_OR_RIGHTS_ADJUSTMENT_OBSERVED_IN_253_SESSION_WINDOW', events: notices.events }, resolutions };
  const model = selected.map(row => {
    const resolution = resolutions.find(value => value.date === row.date);
    return resolution ? { ...row, ...Object.fromEntries(resolution.fields.map(field => [field, resolution.official[field]])) } : row;
  });
  review.modelWindowSha256 = forecastWindowHash(model);
  if (!issues.length) {
    try { reviewedForecastWindow(bars, review, instrument, cutoff); }
    catch (error) { issues.push(error.message); }
  }
  return { status: issues.length ? 'BLOCKED' : 'REVIEW_PROPOSAL', issues: [...new Set(issues)],
    corrections: resolutions.length, proposal: issues.length ? null : review };
}

if (process.argv[1] && import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2];
  if (!file) throw Error('Gebruik: node scripts/research/forecast-source-audit.mjs bronbewijs.json.gz');
  const fs = await import('node:fs/promises');
  const { gunzipSync } = await import('node:zlib');
  const { loadCompanyCatalog } = await import('../history/company-register.mjs');
  const { loadApprovedHistory } = await import('./market-history-source.mjs');
  const bytes = await fs.readFile(file);
  const evidence = JSON.parse(file.endsWith('.gz') ? gunzipSync(bytes).toString() : bytes.toString());
  const records = [];
  for (const input of evidence) {
    const catalog = await loadCompanyCatalog(input.instrument.mic);
    const share = catalog.shares.find(row => row.isin === input.instrument.isin && row.symbol === input.instrument.symbol);
    if (!share) throw Error('UNAPPROVED_FORECAST_INSTRUMENT');
    const bars = await loadApprovedHistory(share, catalog.mic, { cutoff: input.cutoff });
    records.push({ instrument: input.instrument, ...proposeForecastReview(bars, input) });
  }
  console.log(JSON.stringify({ policy: 'REVIEW_PROPOSALS_ONLY_NO_REGISTER_WRITES', records }, null, 2));
}
