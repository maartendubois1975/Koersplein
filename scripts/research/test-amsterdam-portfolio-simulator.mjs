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
