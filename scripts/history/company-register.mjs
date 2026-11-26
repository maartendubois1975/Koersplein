import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {catalogWithListingEvents} from '../../daily-session-view.mjs';
import {assertOperationalMarket,establishedMarkets} from './market-definitions.mjs';
const data = new URL('../../data/', import.meta.url);
const read = async file => JSON.parse(await readFile(new URL(file, data), 'utf8'));
export const instrumentEvents=(await read('instrument-events.json')).events;
export const identityEventAt=(isin,date)=>instrumentEvents.find(e=>e.oldIsin===isin&&date>=e.effectiveDate)||null;
export const companyContracts = (await read('company-register-contracts.json')).markets;

export function validateCompanyCatalog(catalog, contract = companyContracts[catalog?.mic]) {
  if (!contract || !Array.isArray(catalog?.shares)) throw Error('Missing approved company register contract');
  if (catalog.shares.length !== contract.expectedCount) throw Error(`Company count mismatch: ${catalog.mic}`);
  const identities = catalog.shares.map(s => `${s.isin}|${s.symbol}|${s.primaryMic || catalog.mic}`).sort();
  for (const field of ['isin', 'symbol']) {
    if (new Set(catalog.shares.map(s => s[field])).size !== catalog.shares.length) throw Error(`Duplicate company ${field}: ${catalog.mic}`);
  }
  if (catalog.shares.some(s => !s.name || !s.symbol || !/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(s.isin))) throw Error('Invalid company identity');
  for(const share of catalog.shares)if(share.currentListing){
    const current=share.currentListing,event=instrumentEvents.find(e=>e.oldIsin===share.isin);
    if(!event||event.successorStatus!=='VERIFIED_SUCCESSOR'||current.status!==event.successorStatus||current.isin!==event.newIsin||current.mic!==event.mic||current.symbol!==event.symbol||current.effectiveDate!==event.effectiveDate||!/^\d{4}-\d{2}-\d{2}$/.test(current.activeFromSession)||current.activeFromSession<event.effectiveDate||current.activeFromSession>event.successorVerifiedThrough)throw Error('Unverified successor listing '+share.isin);
  }
  const digest = createHash('sha256').update(identities.join('\n')).digest('hex');
  if (digest !== contract.identitySha256) throw Error(`Approved company identities changed: ${catalog.mic}`);
  return catalog;
}
export async function loadCompanyCatalog(mic) {
  const contract = companyContracts[mic];
  if (!contract) throw Error(`No approved company contract: ${mic}`);
  const input = await read(contract.file);
  const catalog = { ...input, mic };
  validateCompanyCatalog(catalog, contract);
  assertOperationalMarket(catalog, contract);
  if (!establishedMarkets.has(mic)) {
    catalog.canonicalHistoryOnly = true;
    catalog.currency ??= contract.navigation.currency;
  }
  return validateCompanyCatalog(catalogWithListingEvents(catalog,instrumentEvents),contract);
}
export async function approvedCompanyUniverse() {
  const markets=await Promise.all(Object.keys(companyContracts).map(loadCompanyCatalog));
  const ids=new Set(), issuers=new Set();
  for(const market of markets)for(const share of market.shares){
    if(ids.has(share.isin))throw Error('Duplicate approved company across markets: '+share.isin);
    ids.add(share.isin);
    if (share.issuerId && issuers.has(share.issuerId)) throw Error('Duplicate issuer across approved registers: '+share.issuerId);
    if (share.issuerId) issuers.add(share.issuerId);
  }
  return markets;
}
