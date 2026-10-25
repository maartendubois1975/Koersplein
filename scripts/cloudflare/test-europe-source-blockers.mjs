import assert from 'node:assert/strict';
import fs from 'node:fs';
const blockers=JSON.parse(fs.readFileSync('research/europe-source-blockers.json','utf8'));
const queue=JSON.parse(fs.readFileSync('research/europe-recovery-priority.json','utf8'));
assert.equal(queue.cutoff,blockers.cutoff);
assert.equal(queue.items.length,20);
assert.equal(new Set(queue.items.map(x=>x.mic+'|'+x.isin)).size,queue.items.length);
const ids=new Set(blockers.sources.map(x=>x.id));
assert.equal(ids.size,blockers.sources.length);
for(const [index,item] of queue.items.entries()){
 assert.equal(item.rank,index+1);
 assert.match(item.isin,/^[A-Z]{2}[A-Z0-9]{10}$/);
 assert.ok(ids.has(item.blockerId));
 assert.equal(item.productionReady,false,'No blocked source may be promoted to production');
 assert.equal(item.reason,'SOURCE_OR_RIGHTS_VERIFICATION_REQUIRED');
}
for(const blocker of blockers.sources){
 assert.ok(blocker.fingerprint&&blocker.reopenWhen);
 assert.notEqual(blocker.status,'APPROVED');
}
console.log('Europe source blocker register: 20 unique blocked instruments and 9 evidence fingerprints PASS');
