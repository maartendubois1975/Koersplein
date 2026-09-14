import { mkdir, writeFile } from 'node:fs/promises';

const source = 'https://live.euronext.com/en/product_directory/data/stocks-amsterdam/download?mics=TNLA%2CXAMC%2CXAMS';
const excludedNames = /WARRANT|\bWARR\b|TREAS SHARES|BUY BACK|DSC2 TS|EUR 12W|EUR 13W/i;

function parseRow(line) {
  const fields = [];
  let value = '';
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const character = line[i];
    if (character === '"') quoted = !quoted;
    else if (character === ';' && !quoted) { fields.push(value); value = ''; }
    else value += character;
  }
  fields.push(value);
  return fields;
}

const response = await fetch(source);
if (!response.ok) throw new Error(`Euronext gaf HTTP ${response.status}`);

const csv = (await response.text()).replace(/^\uFEFF/, '');
const lines = csv.split(/\r?\n/).filter(Boolean);
const headerIndex = lines.findIndex((line) => line.startsWith('Name;'));
if (headerIndex < 0) throw new Error('Euronext-kopregel niet gevonden.');

const shares = lines.slice(headerIndex + 1)
  .map(parseRow)
  .filter((row) => row.length >= 4 && row[0] && row[1] && row[2])
  .filter((row) => !excludedNames.test(row[0]))
  .map(([name, isin, symbol, market]) => ({ name, symbol, isin, market }))
  .sort((a, b) => a.name.localeCompare(b.name, 'nl'));

await mkdir(new URL('../data', import.meta.url), { recursive: true });
await writeFile(new URL('../data/euronext-amsterdam.json', import.meta.url), `${JSON.stringify({
  exchange: 'Euronext Amsterdam',
  mic: 'XAMS',
  retrievedAt: new Date().toISOString(),
  source,
  shares
}, null, 2)}\n`);

console.log(`${shares.length} Amsterdamse aandelen opgeslagen.`);
