import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
// This development branch has no Europe production workflow. Verify its
// actual isolated regression job and retain the daily closed-session guard.
const workflow=await fs.readFile('.github/workflows/xams-regression-check.yml','utf8');
assert.match(workflow,/contents: read/);
assert.ok(!/contents:\s*write|schedule:|render deploy|wrangler deploy/.test(workflow));
assert.ok(!/ref:\s*main\b/.test(workflow));
// A morning/opening trigger must never turn an unfinished trading session
// into immutable daily OHLC. Both the ordinary fetch and historical tail
// are bounded by the last completed-session cutoff, not today's date.
const updater=await fs.readFile('scripts/cloudflare/daily-open-close-update.mjs','utf8');
assert.equal((updater.match(/endDate:freshnessCutoff/g)||[]).length,2,'Both daily provider windows must end at the closed-session cutoff');
assert.ok(!/endDate:today\b/.test(updater),'Unfinished intraday bars must not be eligible for daily history writes');
console.log('Europe EOD importer never fetches current unclosed session bars PASS');
