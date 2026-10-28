import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);
const read = async name => JSON.parse(await readFile(new URL(name, root), 'utf8'));
const shares = await read('data/euronext-amsterdam.json');
const registry = await read('data/history-instruments.json');
const known = new Map(shares.shares.map(s => [s.isin, s]));
const accepted = new Map(registry.providerMappings.map(m => [m.isin, m]));
const reportFiles = process.argv.slice(2);
if (!reportFiles.length) throw Error('Usage: node scripts/history/apply-amsterdam-discovery.mjs data/amsterdam-discovery-result-0.json [...]');
let added = 0;
for (const file of reportFiles) {
  if (!/^data\/amsterdam-discovery-result-\d+\.json$/.test(file)) throw Error('Invalid report filename: ' + file);
  const report = await read(file);
  if (!report.checkedAt || report.checked !== report.verified + report.rejected) throw Error('Invalid discovery counts: ' + file);
  if (report.providerMappings.length !== report.verified || report.failures.length !== report.rejected) throw Error('Incomplete discovery evidence: ' + file);
  for (const mapping of report.providerMappings) {
    const share = known.get(mapping.isin);
    if (!share || share.symbol !== mapping.symbol) throw Error('Catalog mismatch: ' + mapping.isin);
    if (mapping.provider !== 'yahoo-chart' || mapping.currency !== 'EUR' || mapping.providerSymbol !== share.symbol + '.AS') throw Error('Unexpected venue or currency: ' + mapping.isin);
    if (mapping.identitySource !== 'https://live.euronext.com/en/product/equities/' + mapping.isin + '-XAMS') throw Error('Missing official identity reference: ' + mapping.isin);
    const prior = accepted.get(mapping.isin);
    if (prior) {
      if (prior.providerSymbol !== mapping.providerSymbol || prior.symbol !== mapping.symbol) throw Error('Conflicting mapping: ' + mapping.isin);
    } else {
      accepted.set(mapping.isin, mapping);
      added++;
    }
  }
}
const updated = { ...registry, providerMappings: [...accepted.values()].sort((a,b) => a.symbol.localeCompare(b.symbol)) };
if (updated.providerMappings.length > shares.shares.length) throw Error('Too many mappings');
await writeFile(new URL('data/history-instruments.json', root), JSON.stringify(updated, null, 2) + '\n');
console.log('Amsterdam provider mappings:', updated.providerMappings.length, '/', shares.shares.length, '; newly added:', added);
