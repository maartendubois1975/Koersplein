import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {auditBarIssue,isCompleteOhlcBar,isVerifiedNoTradeGap,previousClosedWeekday,validBars,latestAuditBar} from './europe-run-policy.mjs';

const good={date:'2026-10-22',open:100,high:105,low:95,close:102,volume:20};
assert.equal(isCompleteOhlcBar(good),true);
for(const invalid of [
 {...good,open:null},{...good,high:null},{...good,low:null},{...good,close:null},
 {...good,high:101},{...good,low:101},{...good,high:94},{...good,low:106},
 {...good,high:0},{...good,low:-1},{...good,open:'bad'},
 {...good,date:'2026-02-30'}
])assert.equal(isCompleteOhlcBar(invalid),false,'Incomplete or impossible candle must fail '+JSON.stringify(invalid));
const mixed=[{...good,close:101},{...good,high:null},{...good,date:'2026-10-23'},good,{...good,date:'2026-10-21',low:null}];
assert.deepEqual(validBars({bars:mixed},{startDate:'2026-10-22',endDate:'2026-10-22'}),[good],'Keep valid duplicate and exclude partial/out-of-range bars');

assert.equal(auditBarIssue(good,'2026-10-22','2026-10-23'),null);
assert.equal(auditBarIssue({...good,high:null},'2026-10-22','2026-10-23'),'INCOMPLETE_OR_INVALID_OHLC');
assert.equal(auditBarIssue({...good,date:'2026-10-21'},'2026-10-22','2026-10-23'),'STALE_LAST_TRADE');
assert.equal(auditBarIssue({...good,date:'2026-10-24'},'2026-10-22','2026-10-23'),'FUTURE_LAST_TRADE');
assert.equal(auditBarIssue({...good,date:'2026-10-23'},'2026-10-22','2026-10-23'),'SESSION_NOT_YET_CLOSED');
assert.equal(auditBarIssue(null,'2026-10-22','2026-10-23'),'NO_VALID_BAR');
assert.equal(previousClosedWeekday('2026-10-26'),'2026-10-23','Monday looks back to Friday');
assert.equal(previousClosedWeekday('2026-10-23'),'2026-10-22');
assert.throws(()=>previousClosedWeekday('2026-02-30'),/Invalid session date/);
const noTrade={date:'2026-10-22',status:'NO_TRADES',lastTradeDate:null};
assert.equal(isVerifiedNoTradeGap(noTrade,'2026-10-21','2026-10-22'),true);
assert.equal(isVerifiedNoTradeGap(noTrade,'2025-07-24','2026-10-22'),false,'A one-day no-trade snapshot cannot validate a year-old bar');
assert.equal(isVerifiedNoTradeGap({...noTrade,lastTradeDate:'2025-07-24'},'2025-07-24','2026-10-22'),true,'Explicit official last-trade date can validate older bars');
assert.equal(isVerifiedNoTradeGap({...noTrade,lastTradeDate:'2025-07-23'},'2025-07-24','2026-10-22'),false);
assert.equal(isVerifiedNoTradeGap({...noTrade,status:'TRADED'},'2026-10-21','2026-10-22'),false);
assert.equal(isVerifiedNoTradeGap({...noTrade,date:'2026-10-21'},'2026-10-21','2026-10-22'),false);

const audit=await fs.readFile('scripts/cloudflare/audit-daily-open-close.mjs','utf8');
const daily=await fs.readFile('scripts/cloudflare/daily-open-close-update.mjs','utf8');
const official=await fs.readFile('scripts/cloudflare/reconcile-official-daily.mjs','utf8');
for(const [name,content] of [['audit',audit],['daily',daily],['official',official]])assert.match(content,/isCompleteOhlcBar/,'OHLC gate missing in '+name);
assert.match(audit,/isVerifiedNoTradeGap/);
assert.match(audit,/latestAuditBar\(bars,cutoff\)/,'Audit must inspect latest completed session, not an intraday bar');
assert.deepEqual(latestAuditBar([{...good,date:'2026-10-23'},good,{...good,high:null}],'2026-10-22'),good,'Cutoff and complete duplicate take precedence');
assert.deepEqual(latestAuditBar([{...good,high:null},good],'2026-10-22'),good,'Complete duplicate wins regardless of storage order');
assert.match(daily,/isVerifiedNoTradeGap/);
assert.match(official,/OFFICIAL_PARTIAL_OR_INVALID_OHLC/);
const queue=await fs.readFile('scripts/cloudflare/europe-recovery-queue.mjs','utf8');
assert.match(queue,/REPAIR_INCOMPLETE_OHLC/);
assert.match(queue,/officialNoTradeReported/);
console.log('Europe strict OHLC, no-trade evidence and production consumers PASS');
