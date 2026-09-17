import { normalizePitEvidence, projectWorldAt, assertNoFutureLeak } from './pit-core.mjs';

const base = {
  entityId:'TEST', family:'FUNDAMENTALS', signalName:'revenue', validTime:'2020-12-31T00:00:00Z', retrievedTime:'2026-09-17T00:00:00Z', sourceId:'TEST_SOURCE', publisher:'Test', sourceTier:'A', licenseStatus:'PUBLIC', ingestionAdapter:'selftest', adapterVersion:'1', timestampProven:true, pointInTimeSafe:true, trainingEligible:true, unit:'EUR', missing:false
};
const oldVintage = normalizePitEvidence({...base,evidenceId:'e1',vintageId:'v1',rawValue:100,publishedTime:'2021-02-01T07:00:00Z',tradableTime:'2021-02-01T08:00:00Z'});
const revision = normalizePitEvidence({...base,evidenceId:'e2',vintageId:'v2',rawValue:110,publishedTime:'2021-06-01T07:00:00Z',tradableTime:'2021-06-01T08:00:00Z',restatesEvidenceId:'e1'});
const unknownTime = normalizePitEvidence({...base,evidenceId:'e3',vintageId:'v1',signalName:'guidance',rawValue:'up',publishedTime:null,tradableTime:null});
if (unknownTime.trainingEligible) throw new Error('Onbewezen timestamp werd trainbaar');
const feb = projectWorldAt([oldVintage,revision,unknownTime],'2021-03-01T00:00:00Z');
if (feb.length !== 1 || feb[0].rawValue !== 100) throw new Error('Vintage leakage vóór revisie');
const july = projectWorldAt([oldVintage,revision,unknownTime],'2021-07-01T00:00:00Z');
if (july.length !== 1 || july[0].rawValue !== 110) throw new Error('Revisie niet correct zichtbaar na publicatie');
assertNoFutureLeak(feb,'2021-03-01T00:00:00Z');
let missingRejected=false;
try { normalizePitEvidence({...base,evidenceId:'e4',vintageId:'v1',rawValue:0,missing:true,publishedTime:'2021-01-01T00:00:00Z',tradableTime:'2021-01-01T00:00:00Z'}); } catch { missingRejected=true; }
if (!missingRejected) throw new Error('Missing=0 werd niet geweigerd');
console.log(JSON.stringify({ok:true,tests:['unknown-time-quarantine','revision-vintage','cutoff-world','future-leak','missing-not-zero']},null,2));
