import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { validSessionDate } from '../../daily-session-view.mjs';

const fields = ['TradingDateTime', 'MifidInstrumentID', 'MifidPrice', 'MifidQuantity',
  'MifidPriceNotation', 'MifidCurrency', 'Venue', 'MmtMarketMechanism',
  'MmtNegotiationIndicator', 'MmtModificationIndicator', 'MmtBenchMarkIndicator',
  'MmtContributionToPrice', 'MmtContingentTransactionIndicator'];

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

export async function auditEuronextFile(lines, shares, session, parentMic) {
  if (!validSessionDate(session)) throw Error('INVALID_EURONEXT_TAPE_SESSION');
  const catalog = new Map(shares.map(share => [
    (share.primaryMic || share.mic || parentMic) + ':' + share.isin, share,
  ]));
  if (!catalog.size || catalog.size !== shares.length) throw Error('INVALID_EURONEXT_TAPE_REGISTER');
  const dates = {}, venues = {}, mechanisms = {};
  const observed = new Set(), book = new Set();
  let columns, width, lineNumber = 0, eligibleRows = 0, bookRows = 0, nonMatchingValues = 0;
  for await (const line of lines) {
    lineNumber++;
    if (lineNumber === 1) continue;
    if (lineNumber === 2) {
      const header = csvRow(line.replace(/^\uFEFF/, '').trim());
      width = header.length;
      columns = fields.map(field => header.indexOf(field));
      if (columns.includes(-1)) throw Error('UNRECOGNIZED_EURONEXT_TAPE_SCHEMA');
      continue;
    }
    if (!line.trim()) continue;
    const row = csvRow(line);
    if (row.length !== width) throw Error('UNRECOGNIZED_EURONEXT_TAPE_ROW_' + lineNumber);
    const [timestamp, isin, price, quantity, priceUnit, currency, mic, mechanism, ...attributes] =
      columns.map(index => row[index].trim());
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
    eligibleRows++;
    observed.add(key);
    mechanisms[mechanism] = (mechanisms[mechanism] ?? 0) + 1;
    if (mechanism === '1' && attributes.every(value => value === '-')) {
      bookRows++;
      book.add(key);
    }
  }
  if (!columns || !dates[session]) throw Error('EURONEXT_TAPE_SESSION_ABSENT ' + session);
  return { session, dates, venues, approved: catalog.size, observed: observed.size, bookObserved: book.size,
    eligibleRows, bookRows, unqualifiedRows: nonMatchingValues, mechanisms,
    observedListings: [...observed].sort(), bookListings: [...book].sort() };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input, directory, session] = process.argv.slice(2);
  if (!input || !directory || !session) throw Error('Gebruik: node scripts/audit/audit-euronext-trade-file.mjs trades.csv bedrijven.json YYYY-MM-DD');
  const catalog = JSON.parse(await readFile(directory, 'utf8'));
  const lines = createInterface({ input: createReadStream(input), crlfDelay: Infinity });
  console.log(JSON.stringify(await auditEuronextFile(lines, catalog.shares || Object.values(catalog.instruments), session, catalog.mic || catalog.market), null, 2));
}
