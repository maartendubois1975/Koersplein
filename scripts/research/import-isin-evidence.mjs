import fs from 'node:fs/promises';
import path from 'node:path';
import { reconcile } from './reconcile-isin.mjs';

export function parseSourceCsv(text, metadata) {
  if (!metadata || !/^https:\/\//.test(metadata.sourceUrl || '') ||
      !/^\d{4}-\d{2}-\d{2}$/.test(metadata.sourceDate || '') ||
      !metadata.sourceDocument) throw new Error('Source metadata required');
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(x => x.trim());
  const delimiter = lines[0]?.includes(';') ? ';' : ',';
  const columns = lines.shift()?.split(delimiter).map(x => x.trim().toLowerCase());
  if (!columns || !columns.includes('symbol') || !columns.includes('isin')) throw new Error('CSV requires symbol and isin columns');
  return lines.map(line => {
    const fields = line.split(delimiter).map(x => x.trim().replace(/^"|"$/g,''));
    return {symbol:fields[columns.indexOf('symbol')],isin:fields[columns.indexOf('isin')],...metadata};
  });
}
export async function importEvidence(market, csvPath, metadataPath) {
  if (!['athens','warsaw'].includes(market)) throw new Error('Unknown market');
  const catalog = JSON.parse(await fs.readFile(new URL('../../data/euronext-' + market + '.json', import.meta.url),'utf8'));
  const [csv,metadata] = await Promise.all([fs.readFile(csvPath,'utf8'),fs.readFile(metadataPath,'utf8').then(JSON.parse)]);
  return reconcile(catalog,parseSourceCsv(csv,metadata));
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const [market,csv,metadata] = process.argv.slice(2);
  if (!market || !csv || !metadata) throw new Error('Usage: node scripts/research/import-isin-evidence.mjs athens|warsaw source.csv metadata.json');
  console.log(JSON.stringify(await importEvidence(market,csv,metadata),null,2));
}
