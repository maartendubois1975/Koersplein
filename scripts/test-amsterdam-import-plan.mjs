import assert from 'node:assert/strict';
import {tradingSessionsAfter,planAmsterdamImport} from './amsterdam-import-plan.mjs';
assert.deepEqual(tradingSessionsAfter('2026-10-30','2026-11-04'),['2026-11-02','2026-11-03','2026-11-04']);
assert.deepEqual(tradingSessionsAfter('2026-11-04','2026-11-04'),[]);
assert.throws(()=>tradingSessionsAfter('2026-02-30','2026-03-01'));
const last=Array(79).fill('2026-11-03').concat('2026-01-02');
const p=planAmsterdamImport(last,'2026-11-04');
assert.equal(p.sessions.at(-1),'2026-11-04');
assert.equal(p.recentSessions,3);
assert.equal(p.backfillSessions,1);
assert.equal(p.sessions.length,4);
assert.ok(p.deferredSessions>0);
const dates=new Set();
for(let n=0;n<60;n++){
 const d=new Date(Date.UTC(2026,10,4+n)).toISOString().slice(0,10);
 const result=planAmsterdamImport(last,'2026-11-04',{rotationDate:d});
 dates.add(result.sessions[0]);
}
assert.ok(dates.size>1,'historical backfill must rotate');
assert.deepEqual(planAmsterdamImport(Array(80).fill('2026-11-04'),'2026-11-04').sessions,[]);
assert.throws(()=>planAmsterdamImport(Array(79).fill('2026-11-03'),'2026-11-04'));
console.log('PASS canonical Amsterdam import planning');
