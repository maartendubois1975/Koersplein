import { readFile } from 'node:fs/promises';

const read = name => readFile(new URL('../../data/' + name, import.meta.url), 'utf8').then(JSON.parse);
export const [tradingCalendars, marketSources] = await Promise.all([
  read('trading-calendars.json'), read('market-source-registry.json'),
]);
export const parentMic = mic => tradingCalendars.segments[mic] || mic;
export const establishedMarkets = new Set(['XAMS', 'XBRU', 'XPAR', 'XDUB', 'XLIS']);

export function operationalMarketIssues(catalog, contract, { sources = marketSources, calendars = tradingCalendars } = {}) {
  const { mic, shares } = catalog;
  if (establishedMarkets.has(mic)) return [];
  const issues = [];
  const rights = sources.markets[mic];
  const calendar = calendars.calendars[calendars.markets[mic]];
  const clock = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
  const exchange = contract.navigation;
  if (!exchange || !/^[a-z0-9-]+$/.test(exchange.code || '') || !exchange.name || !exchange.country ||
      !/^[A-Z]{3}$/.test(exchange.currency || '') || !calendar?.timezone || !clock.test(calendar.finalizedAfter) ||
      !Object.keys(calendar.years || {}).length) issues.push('INCOMPLETE_MARKET_DEFINITION ' + mic);
  try { if (calendar?.timezone) new Intl.DateTimeFormat('en', { timeZone: calendar.timezone }).format(); }
  catch { issues.push('INVALID_MARKET_TIMEZONE ' + mic); }
  const activeRoles = ['PRIMARY', 'FALLBACK', 'DISCOVERY_FALLBACK'];
  const daily = rights?.dailySources || [], history = rights?.historySources || [];
  if (rights?.status !== 'APPROVED' || daily.filter(row => row.role === 'PRIMARY').length !== 1 ||
      history.filter(row => row.role === 'PRIMARY').length !== 1) issues.push('INCOMPLETE_OPERATIONAL_SOURCE_ROUTES ' + mic);
  const dailyIds = daily.filter(row => activeRoles.includes(row.role)).map(row => row.provider);
  if (rights?.officialDailyProvider && !dailyIds.includes(rights?.officialDailyProvider)) {
    issues.push('UNAPPROVED_OFFICIAL_DAILY_PROVIDER ' + mic);
  }
  for (const id of new Set([...daily, ...history].filter(row => activeRoles.includes(row.role)).map(row => row.provider))) {
    const permission = rights?.publication?.[id];
    if (permission?.free !== true || permission.publicArchive !== true || permission.publicDisplay !== true ||
        !/^https:\/\//.test(permission.evidenceUrl || '')) issues.push('UNVERIFIED_PUBLICATION_RIGHTS ' + mic + ' ' + id);
  }
  const issuerIds = new Set();
  for (const share of shares) {
    const listing = share.primaryMic || share.mic || mic;
    if ((calendars.segments[listing] || listing) !== mic || !/^[A-Z]{3}$/.test(share.currency || exchange?.currency) ||
        !share.issuerId || issuerIds.has(share.issuerId)) issues.push('INVALID_ADMITTED_LISTING ' + share.isin);
    issuerIds.add(share.issuerId);
  }
  return issues;
}

export function assertOperationalMarket(catalog, contract, options) {
  const issues = operationalMarketIssues(catalog, contract, options);
  if (issues.length) throw Error(issues[0]);
}
