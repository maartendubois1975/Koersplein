import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const data = new URL('../../data/', import.meta.url);
const read = async file => JSON.parse(await readFile(new URL(file, data), 'utf8'));
export const companyContracts = (await read('company-register-contracts.json')).markets;

export function validateCompanyCatalog(catalog, contract = companyContracts[catalog?.mic]) {
  if (!contract || !Array.isArray(catalog?.shares)) throw Error('Missing approved company register contract');
  if (catalog.shares.length !== contract.expectedCount) throw Error(`Company count mismatch: ${catalog.mic}`);
  const identities = catalog.shares.map(s => `${s.isin}|${s.symbol}|${s.primaryMic || catalog.mic}`).sort();
  for (const field of ['isin', 'symbol']) {
    if (new Set(catalog.shares.map(s => s[field])).size !== catalog.shares.length) throw Error(`Duplicate company ${field}: ${catalog.mic}`);
  }
  if (catalog.shares.some(s => !s.name || !s.symbol || !/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(s.isin))) throw Error('Invalid company identity');
  const digest = createHash('sha256').update(identities.join('\n')).digest('hex');
  if (digest !== contract.identitySha256) throw Error(`Approved company identities changed: ${catalog.mic}`);
  return catalog;
}
export async function loadCompanyCatalog(mic) {
  const contract = companyContracts[mic];
  if (!contract) throw Error(`No approved company contract: ${mic}`);
  const input = await read(contract.file);
  const catalog = mic === 'XPAR' ? { ...input, exchange: 'Euronext Paris', mic } : input;
  return validateCompanyCatalog(catalog, contract);
}