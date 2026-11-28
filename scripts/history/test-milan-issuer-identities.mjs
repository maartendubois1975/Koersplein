import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { issuerIdentityProposals, validLei } from './issuer-identity.mjs';
import { validateCompanyCatalog } from './company-register.mjs';
const read = file => fs.readFile(file, 'utf8').then(JSON.parse);
const catalog = await read('research/milan/2026-11-26/approved-companies.json');
const evidence = await read('research/admission/2026-11-27/milan-issuer-decisions.json');
const contract = (await read('data/company-register-contracts.json')).catalogPreviews.XMIL;
assert.equal(evidence.matched, 357); assert.equal(evidence.supplemental, 3);
const proposed = issuerIdentityProposals(catalog, evidence.records);
assert.equal(proposed.proposals.length, 360); assert.deepEqual(proposed.unresolved, []); assert.deepEqual(proposed.multipleClasses, []);
for (const proposal of proposed.proposals) assert.equal(catalog.shares.find(share => share.isin === proposal.isin).issuerId, proposal.issuerId);
validateCompanyCatalog(catalog, contract);
assert(validLei('81560076E3944316DB24'));
assert(!validLei('81560076E3944316DB25'));
const duplicate = structuredClone(catalog); duplicate.shares[1].issuerId = duplicate.shares[0].issuerId;
assert.throws(() => validateCompanyCatalog(duplicate, contract), /duplicate approved issuer/);
const second = evidence.records.find(row => row.symbol === 'A2A');
const ambiguous = issuerIdentityProposals(catalog, [...evidence.records, { ...second, lei: evidence.records[0].lei }]);
assert(ambiguous.unresolved.some(row => row.isin === second.isin && row.reason === 'AMBIGUOUS_LEI'));
for (const symbol of ['CPR','CEM','DIS']) {
  const entity = await read('research/admission/2026-11-27/' + symbol + '-gleif-entity.json');
  assert.equal(entity.data.id, evidence.records.find(row => row.symbol === symbol).lei);
  assert.equal(entity.data.attributes.entity.status, 'ACTIVE');
}
assert.equal((await read('data/company-register-contracts.json')).markets.XMIL, undefined);
console.log('357 certified mappings + 3 primary-source identities, 360 distinct LEIs, checksum/ambiguity/duplicate guards PASS');
