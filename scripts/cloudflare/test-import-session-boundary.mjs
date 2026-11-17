import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
// This development branch has no Europe production workflow. Verify its
// actual isolated regression job and retain the daily closed-session guard.
const workflow=await fs.readFile('.github/workflows/approved-regression-check.yml','utf8');
assert.match(workflow,/contents: read/);
assert.ok(!/contents:\s*write|schedule:|render deploy|wrangler deploy/.test(workflow));
assert.ok(!/ref:\s*main\b/.test(workflow));
// A morning/opening trigger must never turn an unfinished trading session
// into immutable daily OHLC. Both the ordinary fetch and historical tail
// are bounded by the last completed-session cutoff, not today's date.
const {collectApprovedSession}=await import('./approved-daily-session.mjs');
await assert.rejects(()=>collectApprovedSession({market:'XAMS',session:'2026-10-23',now:new Date('2026-10-23T10:00:00Z'),catalog:{shares:[]}}),/unclosed/);
await assert.rejects(()=>collectApprovedSession({market:'XAMS',session:'2026-02-30',catalog:{shares:[]}}),/Invalid/);
console.log('Universal EOD importer rejects future and impossible sessions PASS');
