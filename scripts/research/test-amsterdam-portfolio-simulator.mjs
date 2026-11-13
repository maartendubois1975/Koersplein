import assert from 'node:assert/strict';
import {simulatePortfolio} from './amsterdam-portfolio-simulator.mjs';
const bars=[
 {date:'2026-01-01',instrument:'A',close:100},
 {date:'2026-01-02',instrument:'A',close:110},
 {date:'2026-01-03',instrument:'A',close:120},
 {date:'2026-01-03',instrument:'B',close:50},
 {date:'2026-01-04',instrument:'B',close:55}
];
const r=simulatePortfolio({bars,decisions:[{date:'2026-01-01',picks:['A']},{date:'2026-01-03',picks:['B']}]});
assert.equal(r.ledger.length,3);
assert.deepEqual(r.ledger.map(x=>x.side),['BUY','SELL','BUY']);
assert.ok(r.totalFees>0);
assert.ok(r.finalNav>100000);
assert.ok(r.equity.every(x=>x.cash>=-1e-7));
const cash=simulatePortfolio({bars,decisions:[]});
assert.equal(cash.finalNav,100000);
assert.equal(cash.totalFees,0);
assert.throws(()=>simulatePortfolio({initialCash:-1}));
console.log('Amsterdam portfolio simulator unit checks passed');


const flat=simulatePortfolio({bars:[{date:'2026-02-01',instrument:'X',close:100},{date:'2026-02-02',instrument:'X',close:100}],decisions:[{date:'2026-02-01',picks:['X']},{date:'2026-02-02',picks:[]}],costRate:0.01});
assert.equal(flat.ledger.length,2);
assert.ok(flat.finalNav<100000,'Round-trip costs must reduce NAV on flat prices');
assert.ok(Math.abs(flat.totalFees-(100000-flat.finalNav))<0.0001);
const stale=simulatePortfolio({bars:[{date:'2026-02-01',instrument:'X',close:100},{date:'2026-02-02',instrument:'Y',close:100}],decisions:[{date:'2026-02-02',picks:['X']}],costRate:0});
assert.equal(stale.ledger.length,0,'No trade at stale prices');
console.log('Additional fee and stale-price checks passed');
