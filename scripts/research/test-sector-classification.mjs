import assert from 'node:assert/strict';import {classificationFor,sectorCoverage} from './sector-classification-core.mjs';
const x=classificationFor('NL0010273215','2020-01-01');assert.equal(x.sector,'UNKNOWN');assert.equal(x.eligibleForPeerModel,false);
const c=sectorCoverage(['NL0010273215','NL0000000000'],'2020-01-01');assert.equal(c.eligible,0);assert.equal(c.unknown,2);console.log(JSON.stringify({status:'PASS',unknownFallback:x,coverage:c}));
