import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const cfg = JSON.parse(readFileSync(new URL('../../config/consolidation-ownership.json', import.meta.url), 'utf8'));
assert.equal(cfg.schemaVersion, 1);
assert.equal(cfg.status, 'planned-not-active', 'Consolidatie mag niet ongemerkt actief worden');
assert.equal(cfg.productionDeployAllowed, false, 'Productiedeploy vereist aparte goedkeuring');
assert.ok(cfg.canonicalBranch && cfg.productionBranch);
const services = cfg.currentRenderServices;
assert.ok(Array.isArray(services) && services.length > 0);
assert.equal(new Set(services.map(s => s.name)).size, services.length, 'Dubbele Render-servicenaam');
assert.equal(services.filter(s => s.role === 'production').length, 1, 'Precies één productieomgeving vereist');
for (const s of services) {
  assert.ok(s.name && s.branch);
  assert.equal(s.autoDeploy, false, 'Huidige Render-deploystatus onverwacht gewijzigd: ' + s.name);
}
for (const [dataset, owner] of Object.entries(cfg.datasetOwners)) {
  assert.ok(owner.writer, 'Writer ontbreekt voor ' + dataset);
}
console.log('Consolidation configuration: structure OK; NOT a live ownership or deployment audit.');
