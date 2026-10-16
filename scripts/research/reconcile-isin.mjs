import fs from 'node:fs/promises';
import path from 'node:path';

const root = new URL('../../', import.meta.url);
const isinValid = value => {
  if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(value || '')) return false;
  const digits = value.replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55));
  let sum = 0, double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (double) { n *= 2; if (n > 9) n -= 9; }
    sum += n; double = !double;
  }
  return sum % 10 === 0;
};
export function reconcile(catalog, evidence) {
  if (!['XATH','XWAR'].includes(catalog.mic)) throw new Error('Only XATH/XWAR');
  if (!Array.isArray(evidence)) throw new Error('Evidence must be an array');
  const symbols = new Map(catalog.shares.map(s => [s.symbol, s]));
  const seen = new Set(), isins = new Set(), accepted = [], rejected = [];
  for (const row of evidence) {
    const symbol = String(row.symbol || '').trim(), isin = String(row.isin || '').trim().toUpperCase();
    const key = symbol + '|' + isin;
    if (seen.has(symbol) || !symbols.has(symbol) || !isinValid(isin) ||
        !/^https:\/\//.test(row.sourceUrl || '') || !/^\d{4}-\d{2}-\d{2}$/.test(row.sourceDate || '') ||
        !row.sourceDocument || isins.has(isin) || symbols.get(symbol).isin) {
      rejected.push({symbol, isin, reason:'Missing/duplicate symbol, invalid ISIN, missing dated HTTPS document evidence, duplicate ISIN, or already resolved'});
      continue;
    }
    seen.add(symbol); isins.add(isin);
    accepted.push({symbol, isin, sourceUrl:row.sourceUrl, sourceDocument:row.sourceDocument, sourceDate:row.sourceDate});
  }
  return {mic:catalog.mic, total:catalog.shares.length, accepted, rejected,
    unresolved:catalog.shares.length - catalog.shares.filter(s => s.isin).length - accepted.length};
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const [market, evidencePath] = process.argv.slice(2);
  if (!['athens','warsaw'].includes(market) || !evidencePath) throw new Error('Usage: node scripts/research/reconcile-isin.mjs athens|warsaw evidence.json');
  const catalog = JSON.parse(await fs.readFile(new URL('../../data/euronext-' + market + '.json', import.meta.url)));
  const evidence = JSON.parse(await fs.readFile(evidencePath,'utf8'));
  console.log(JSON.stringify(reconcile(catalog,evidence),null,2));
}
