import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { validSessionDate } from '../../daily-session-view.mjs';

const fields = ['TradingDateTime', 'MifidInstrumentID', 'MifidPrice', 'MifidQuantity',
  'MifidPriceNotation', 'MifidCurrency', 'Venue', 'MmtMarketMechanism',
  'MmtNegotiationIndicator', 'MmtModificationIndicator', 'MmtBenchMarkIndicator',
  'MmtContributionToPrice', 'MmtContingentTransactionIndicator', 'PublicationDateTime', 'TradeUniqueIdentifier'];

function csvRow(line) {
  const pattern = /(?:"((?:[^"]|"")*)"|([^",]*))(,|$)/y;
  const cells = [];
  do {
    const match = pattern.exec(line);
    if (!match) throw Error('INVALID_EURONEXT_CSV_CELL');
    cells.push(match[1]?.replaceAll('""', '"') ?? match[2]);
    if (match[3] === '') return cells;
  } while (pattern.lastIndex <= line.length);
  return cells;
}

export async function auditEuronextFile(lines, shares, session, parentMic, { listingDetails = false } = {}) {
  if (!validSessionDate(session)) throw Error('INVALID_EURONEXT_TAPE_SESSION');
  const catalog = new Map(shares.map(share => [
    (share.primaryMic || share.mic || parentMic) + ':' + share.isin, share,
  ]));
  if (!catalog.size || catalog.size !== shares.length) throw Error('INVALID_EURONEXT_TAPE_REGISTER');
  if (listingDetails && shares.some(share => !['MTAA', 'EXGM'].includes(share.primaryMic || share.mic || parentMic))) throw Error('DETAILS_REQUIRE_MILAN_SESSION_DEFINITION');
  const dates = {}, venues = {}, mechanisms = {};
  const observed = new Set(), book = new Set(), details = new Map();
  const ids = new Map();
  const sessionAtNoon = new Date(session + 'T12:00:00Z');
  const localHour = Number(new Intl.DateTimeFormat('en', { timeZone: 'Europe/Rome', hour: '2-digit', hourCycle: 'h23' }).format(sessionAtNoon));
  const continuousEnd = session + 'T' + String(17 - (localHour - 12)).padStart(2, '0') + ':30:00';
  const finalInterval = continuousEnd.slice(0, 14) + '20:00';
  let columns, width, lineNumber = 0, eligibleRows = 0, bookRows = 0, nonMatchingValues = 0;
  for await (const line of lines) {
    lineNumber++;
    if (lineNumber === 1) continue;
    if (lineNumber === 2) {
      const header = csvRow(line.replace(/^\uFEFF/, '').trim());
      width = header.length;
      columns = fields.map(field => header.indexOf(field));
      if (columns.slice(0, listingDetails ? fields.length : fields.length - 2).includes(-1)) throw Error('UNRECOGNIZED_EURONEXT_TAPE_SCHEMA');
      continue;
    }
    if (!line.trim()) continue;
    const row = csvRow(line);
    if (row.length !== width) throw Error('UNRECOGNIZED_EURONEXT_TAPE_ROW_' + lineNumber);
    const [timestamp, isin, price, quantity, priceUnit, currency, mic, mechanism, negotiation, modification, benchmark, contribution, contingent, publication, tradeId] =
      columns.map(index => index < 0 ? '' : row[index].trim());
    const date = timestamp.slice(0, 10);
    if (!validSessionDate(date) || !/^[A-Z0-9]{4}$/.test(mic)) throw Error('INVALID_EURONEXT_TAPE_IDENTITY_' + lineNumber);
    dates[date] = (dates[date] ?? 0) + 1;
    venues[mic] = (venues[mic] ?? 0) + 1;
    const key = mic + ':' + isin, share = catalog.get(key);
    if (!share || date !== session) continue;
    if (priceUnit !== 'MONE' || currency !== (share.currency || 'EUR') ||
        !Number.isFinite(Number(price)) || Number(price) <= 0 ||
        !Number.isSafeInteger(Number(quantity)) || Number(quantity) <= 0) {
      nonMatchingValues++;
      continue;
    }
    if (listingDetails) {
      if (!tradeId || !Number.isFinite(Date.parse(timestamp)) || !Number.isFinite(Date.parse(publication))) {
        throw Error('INVALID_EURONEXT_TRADE_PROVENANCE_' + lineNumber);
      }
      const id = mic + ':' + tradeId;
      const signature = JSON.stringify([timestamp, isin, price, quantity, mechanism, negotiation, modification, benchmark, contribution, contingent]);
      if (ids.has(id)) {
        if (ids.get(id) !== signature) throw Error('CONFLICTING_EURONEXT_TRADE_ID_' + id);
        continue;
      }
      ids.set(id, signature);
      if (!details.has(key)) details.set(key, { isin, mic, symbol: share.symbol, trades: 0,
        totalVolume: 0, bookVolume: 0, darkVolume: 0, offBookVolume: 0, unclassifiedVolume: 0,
        first: null, last: null, lastCandidatePrices: new Set(), high: null, low: null, finalIntervalValue: 0, finalIntervalVolume: 0,
        closingPhasePrices: new Set(), modifications: 0 });
      const entry = details.get(key), value = Number(price), units = Number(quantity);
      entry.trades++;
      entry.totalVolume += units;
      if (!Number.isSafeInteger(entry.totalVolume)) throw Error('UNSAFE_EURONEXT_TOTAL_VOLUME');
      const volumeField = { '1': 'bookVolume', '3': 'darkVolume', '4': 'offBookVolume' }[mechanism] || 'unclassifiedVolume';
      entry[volumeField] += units;
      if (modification !== '-') entry.modifications++;
      if (mechanism === '1' && [negotiation, modification, benchmark, contribution, contingent].every(value => value === '-')) {
        const trade = { timestamp, publication, price: value };
        const order = row => row.timestamp + '|' + row.publication;
        if (!entry.first || order(trade) < order(entry.first)) entry.first = trade;
        if (!entry.last || order(trade) > order(entry.last)) { entry.last = trade; entry.lastCandidatePrices = new Set([value]); }
        else if (order(trade) === order(entry.last)) entry.lastCandidatePrices.add(value);
        entry.high = entry.high == null ? value : Math.max(entry.high, value);
        entry.low = entry.low == null ? value : Math.min(entry.low, value);
        if (timestamp >= finalInterval && timestamp < continuousEnd) {
          entry.finalIntervalValue += value * units;
          entry.finalIntervalVolume += units;
        }
        const auctionEnd = continuousEnd.slice(0, 14) + '36:00';
        if (timestamp >= continuousEnd && timestamp < auctionEnd) entry.closingPhasePrices.add(value);
      }
    }
    eligibleRows++;
    observed.add(key);
    mechanisms[mechanism] = (mechanisms[mechanism] ?? 0) + 1;
    if (mechanism === '1' && [negotiation, modification, benchmark, contribution, contingent].every(value => value === '-')) {
      bookRows++;
      book.add(key);
    }
  }
  if (!columns || !dates[session]) throw Error('EURONEXT_TAPE_SESSION_ABSENT ' + session);
  return { session, dates, venues, approved: catalog.size, observed: observed.size, bookObserved: book.size,
    eligibleRows, bookRows, unqualifiedRows: nonMatchingValues, mechanisms,
    observedListings: [...observed].sort(), bookListings: [...book].sort(),
    ...(listingDetails ? { listings: [...details.values()].map(({ finalIntervalValue, finalIntervalVolume, closingPhasePrices, lastCandidatePrices, ...entry }) => ({
      ...entry, lastCandidatePrices: [...lastCandidatePrices].sort((a, b) => a - b), finalIntervalVolume, finalIntervalVwap: finalIntervalVolume ? finalIntervalValue / finalIntervalVolume : null,
      closingPhasePrices: [...closingPhasePrices].sort((a, b) => a - b),
    })).sort((a, b) => (a.mic + a.isin).localeCompare(b.mic + b.isin)) } : {}) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input, directory, session] = process.argv.slice(2);
  if (!input || !directory || !session) throw Error('Gebruik: node scripts/audit/audit-euronext-trade-file.mjs trades.csv bedrijven.json YYYY-MM-DD');
  const catalog = JSON.parse(await readFile(directory, 'utf8'));
  const lines = createInterface({ input: createReadStream(input), crlfDelay: Infinity });
  console.log(JSON.stringify(await auditEuronextFile(lines, catalog.shares || Object.values(catalog.instruments), session, catalog.mic || catalog.market, { listingDetails: process.argv.includes('--listing-details') }), null, 2));
}
