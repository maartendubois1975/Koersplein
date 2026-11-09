import assert from 'node:assert/strict';
import { assertFactoryMarket, factoryCoverage } from './factory-policy.mjs';
assert.equal(assertFactoryMarket('XAMS'),'XAMS');
for (const mic of ['XBRU','XPAR',null,'']) assert.throws(()=>assertFactoryMarket(mic),/only supports XAMS/);
assert.deepEqual(factoryCoverage({first_date:'2024-01-01',last_date:'2024-01-02'},{}),{firstDate:'2024-01-01',lastDate:'2024-01-02'});
assert.deepEqual(factoryCoverage(null,{first_date:'2020-01-01',last_date:'2020-01-02'}),{firstDate:'2020-01-01',lastDate:'2020-01-02'});
assert.deepEqual(factoryCoverage(null,{}),{firstDate:null,lastDate:null});
console.log('Factory market and coverage policy tests passed');
