import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { listingIdentity, validSessionDate } from '../../daily-session-view.mjs';
import { companyContracts, loadCompanyCatalog, validateCompanyCatalog } from './company-register.mjs';
import { parentMic } from './market-definitions.mjs';

export function catalogDrift(catalog, observed) {
  const date = observed.asOf;
  if (observed.mic !== catalog.mic || !validSessionDate(date) || !observed.sourceUrl?.startsWith('https://') ||
      !Array.isArray(observed.shares) || !observed.shares.length) throw Error('INVALID_DIRECTORY_EVIDENCE');
  const groups = new Map();
  function include(kind, row, key) {
    if (!key) return;
    if (!groups.has(kind)) groups.set(kind, new Map());
    const entries = groups.get(kind);
    if (!entries.has(key)) entries.set(key, []);
    entries.get(key).push(row);
  }
  const approved = new Map(catalog.shares.map(share => {
    const identity = listingIdentity(share, catalog.mic, date);
    return [identity.storageKey, identity];
  }));
  const listingKeys = new Set();
  const newListings = [];
  let withoutIssuerId = 0;
  for (const share of observed.shares) {
    const identity = listingIdentity(share, catalog.mic, date);
    if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(identity.isin || '') ||
        parentMic(identity.mic) !== catalog.mic || !identity.symbol) throw Error('INVALID_DIRECTORY_LISTING');
    const row = { ...identity, issuerId: share.issuerId ?? null };
    include('isin', row, row.isin);
    include('issuer', row, row.issuerId);
    if (!row.issuerId) withoutIssuerId++;
    if (!approved.has(row.storageKey) || approved.get(row.storageKey).symbol !== row.symbol) newListings.push(row);
    listingKeys.add(row.storageKey);
  }
  const repeated = kind => [...(groups.get(kind) ?? [])]
    .filter(([, rows]) => (kind === 'isin' ? rows.length : new Set(rows.map(row => row.isin)).size) > 1)
    .map(([id, listings]) => ({ id, listings }));
  return { market: catalog.mic, asOf: date, sourceUrl: observed.sourceUrl,
    newListings, missingListings: [...approved.values()].filter(row => !listingKeys.has(row.storageKey)),
    duplicateIsins: repeated('isin'), multipleClasses: repeated('issuer'), withoutIssuerId };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [mic, observedFile] = process.argv.slice(2);
  if (!mic || !observedFile) throw Error('Gebruik: node scripts/history/catalog-drift.mjs MIC directory.json');
  const read = async file => JSON.parse(await readFile(file, 'utf8'));
  const preview = (await read('data/company-register-contracts.json')).catalogPreviews?.[mic];
  if (!companyContracts[mic] && !preview) throw Error('UNKNOWN_REVIEWED_MARKET ' + mic);
  const catalog = companyContracts[mic] ? await loadCompanyCatalog(mic)
    : validateCompanyCatalog(await read('data/' + preview?.file), preview);
  console.log(JSON.stringify(catalogDrift(catalog, await read(observedFile)), null, 2));
}
