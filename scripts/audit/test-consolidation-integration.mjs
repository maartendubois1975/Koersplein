import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const daily=read('scripts/cloudflare/daily-open-close-update.mjs');
const official=read('scripts/cloudflare/reconcile-official-daily.mjs');
const universal=read('scripts/cloudflare/universal-market-runner.mjs');
const factory=read('scripts/cloudflare/factory-runner.mjs');
const golden=read('scripts/cloudflare/import-golden.mjs');
for(const [name,source] of [['daily',daily],['universal',universal],['factory',factory],['golden',golden]]) {
 assert.match(source,/writeCloudflareHistory\(/,name+' must use shared history writer');
 assert.doesNotMatch(source,/client\.putPartition\(/,name+' must not bypass shared writer');
}
for(const [name,source] of [['daily',daily],['official',official]]) {
 assert.match(source,/authorizeMarketShard\(/,name+' must authorize each market in shard');
 assert.match(source,/writer: 'cloudflare-daily'/,name+' must share one daily owner');
}
assert.match(daily,/dataset: 'marketCatalog'/);
assert.match(universal,/dataset: 'marketCatalog'/);
assert.match(golden,/dataset: 'marketCatalog'/);
assert.match(factory,/assertFactoryMarket\(item\.mic\)/);
const routes=JSON.parse(read('config/writer-routes.json'));
assert.equal(routes.activation,'disabled','Production/staging writers must not activate as a side effect of consolidation');
console.log('Consolidation integration invariants passed');
