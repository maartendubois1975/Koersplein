import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const workflow=await fs.readFile('.github/workflows/daily-open-close.yml','utf8');
const pinned='ref: $'+'{{ github.sha }}';
const checkoutBlocks=workflow.split(/- uses: actions\/checkout@v4/).slice(1);
assert.equal(checkoutBlocks.length,4,'All four production checkout steps must be accounted for');
for(const [index,block] of checkoutBlocks.entries()){
 const preStep=block.split(/\n\s*- (?:name:|uses:)/)[0];
 if(index===2){assert.ok(!/ref:\s*main\b/.test(preStep),'Default event SHA is safe for Paris read-only diagnostic');continue;}
 assert.ok(preStep.includes(pinned),'Production checkout '+index+' must use the immutable triggering commit SHA');
}
assert.ok(!/ref:\s*main\b/.test(workflow),'No production job may silently switch to a newer main revision');
console.log('Europe daily workflow immutable commit pinning: all update, summary and repair jobs PASS');

// A morning/opening trigger must never turn an unfinished trading session
// into immutable daily OHLC. Both the ordinary fetch and historical tail
// are bounded by the last completed-session cutoff, not today's date.
const updater=await fs.readFile('scripts/cloudflare/daily-open-close-update.mjs','utf8');
assert.equal((updater.match(/endDate:freshnessCutoff/g)||[]).length,2,'Both daily provider windows must end at the closed-session cutoff');
assert.ok(!/endDate:today\b/.test(updater),'Unfinished intraday bars must not be eligible for daily history writes');
console.log('Europe EOD importer never fetches current unclosed session bars PASS');
