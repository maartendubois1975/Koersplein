import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { issuerIdentityProposals, validLei } from './issuer-identity.mjs';
import { approvedCompanyUniverse } from './company-register.mjs';

const root = 'research/admission/2026-11-28/';
const read = file => fs.readFile(file, 'utf8').then(JSON.parse);
const hash = raw => createHash('sha256').update(raw).digest('hex');
const review = await read(root + 'oslo-issuer-review.json');
assert.equal(hash(await fs.readFile(review.candidateFile)), review.candidateSha256);
assert.equal(hash(await fs.readFile(review.baseFile)), review.baseSha256);
const catalog = await read(review.candidateFile), previous = await read(review.baseFile);
assert.equal(catalog.shares.length, 244);
assert.equal(review.decisions.length, 22);
const approved = [];
for (const row of review.decisions) {
  assert(catalog.shares.some(share => share.isin === row.isin && share.symbol === row.symbol));
  const raw = await fs.readFile(root + row.gleif.file);
  assert.equal(hash(raw), row.gleif.sha256);
  const entity = JSON.parse(raw).data.attributes, lei = row.issuerId.slice(4);
  assert(validLei(lei)); assert.equal(entity.lei, lei);
  assert.equal(entity.entity.status, 'ACTIVE'); assert.equal(entity.registration.status, 'ISSUED');
  if (row.status !== 'VERIFIED_ISSUER_PROPOSAL') {
    assert.equal(row.isin, 'BMG763301022'); assert.equal(row.primary, null);
    continue;
  }
  assert(row.primary.url.startsWith('https://'));
  assert(/^[a-f0-9]{64}$/.test(row.primary.sha256));
  assert.equal(row.primary.isinObserved, true);
  if (row.primary.mode === 'PRIMARY_ISIN_REGISTRATION_GLEIF_BRIDGE') {
    assert.equal(row.isin, 'CY0101550917');
    const bridge = row.primary.registrationBridge;
    assert.equal(entity.entity.registeredAs, bridge.gleifRegisteredAs);
    assert.equal(entity.entity.registeredAt.id, bridge.authority);
    assert(entity.entity.otherNames.some(name => name.name === bridge.previousLegalName));
    assert.equal(bridge.sourceRegisteredAs, 'HE 277936');
  } else {
    assert.equal(row.primary.mode, 'PRIMARY_ISIN_LEI_COOBSERVED');
    assert.equal(row.primary.leiObserved, true);
  }
  approved.push({ isin: row.isin, lei });
}
assert.equal(approved.length, 21);
const expected = issuerIdentityProposals(catalog, [
  ...previous.proposals.map(row => ({ isin: row.isin, lei: row.issuerId.slice(4) })), ...approved,
]);
assert.deepEqual(review.proposals, expected.proposals);
assert.deepEqual(review.unresolved, expected.unresolved);
assert.equal(expected.proposals.length, 243); assert.equal(expected.unresolved.length, 1);
assert.deepEqual(expected.multipleClasses, []);
for (const old of previous.proposals) assert(review.proposals.some(row => row.isin === old.isin && row.issuerId === old.issuerId));
const active = await approvedCompanyUniverse();
assert.equal(active.reduce((n, market) => n + market.shares.length, 0), 899);
assert(!active.some(market => market.mic === 'XOSL'));
console.log('Oslo: 22 current GLEIF records, 21 reviewed primary bridges, all 222 prior proposals retained, 243/244 issuer proposals; RomReal and operational admission remain blocked PASS');
