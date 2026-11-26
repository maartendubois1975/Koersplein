import {scoreForward} from './analytics.mjs';
import {outcome} from './research-quality.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {horizonEndDate,evaluateOpportunity} from './exam-outcomes-core.mjs';
import {sealOpportunity,verifyOpportunity,verifyOpportunityAppend} from './prediction-ledger-core.mjs';
assert.equal(horizonEndDate('2024-01-31',1),'2024-02-29');
assert.equal(horizonEndDate('2026-01-31',3),'2026-04-30');
assert.throws(()=>horizonEndDate('2026-02-30',3),/INVALID_REFERENCE/);
// Find the late-hit regression in real committed history, rather than fabricating market prices.
let caseFound=null;
for(const file of (await fs.readdir('data/history')).filter(f=>f.endsWith('.json'))){
 const doc=JSON.parse(await fs.readFile('data/history/'+file,'utf8'));const bars=(doc.bars||[]).filter(b=>Number.isFinite(b.close)&&b.close>0).sort((a,b)=>a.date.localeCompare(b.date));
 for(let i=0;i<bars.length-130&&!caseFound;i+=15){
  const reference=bars[i],end=horizonEndDate(reference.date,3),inside=bars.slice(i+1).filter(b=>b.date<=end),late=bars.slice(i+1).find(b=>b.date>end&&b.close>=reference.close*1.3);
  if(inside.length&&bars.at(-1).date>=end&&!inside.some(b=>b.close>=reference.close*1.3)&&late)caseFound={bars,reference,end,late};
 }
 if(caseFound)break;
}
assert(caseFound,'Real historical late-hit fixture must exist');
const {bars,reference,end,late}=caseFound;
const index=bars.findIndex(b=>b.date===reference.date);
assert.equal(scoreForward({bars},index,3,30).target_hit,false);
assert.equal(outcome(bars,index,.3,3).hit,0);
const p=sealOpportunity({isin:'historical-regression-fixture',market:'fixture',referenceDate:reference.date,referenceClose:reference.close,horizonMonths:3,targetPct:30,frozen:true,createdAt:reference.date+'T20:00:00Z'});
assert(verifyOpportunity(p));
const measured=evaluateOpportunity(p,bars,{asOf:late.date});
assert.equal(measured.endDate,end);assert.equal(measured.status,'CLOSED');assert.equal(measured.result30,false);assert.equal(measured.hit30,false);assert.equal(measured.hit30Date,null);assert(measured.latestDate<=end);
const again=evaluateOpportunity({...p,hit30:true,hit30Date:late.date,result30:true},bars,{asOf:late.date});assert.equal(again.result30,false,'Old erroneous success flag must not survive horizon correction');
assert.throws(()=>verifyOpportunity({...p,referenceClose:p.referenceClose+1}),/FROZEN_OPPORTUNITY_CHANGED/);
assert.throws(()=>evaluateOpportunity({...p,referenceClose:p.referenceClose+1},bars,{asOf:late.date}),/REFERENCE_PRICE_MISMATCH/);
assert.equal(JSON.stringify(p),JSON.stringify(sealOpportunity(p)),'Outcome evaluation never changes frozen prediction fields');
assert(verifyOpportunityAppend([p],[{...p,...measured}]));
assert.throws(()=>verifyOpportunityAppend([p],[]),/SAVED_OPPORTUNITY_CHANGED/);
assert.throws(()=>verifyOpportunityAppend([p],[sealOpportunity({...p,referenceClose:p.referenceClose+1})]),/SAVED_OPPORTUNITY_CHANGED/);
assert.throws(()=>verifyOpportunityAppend([p],[p,p]),/DUPLICATE_OPPORTUNITY/);
assert.throws(()=>verifyOpportunityAppend([p],[{...p,immutable:false}]),/OPPORTUNITY_NOT_SEALED/);
console.log('Real-history late +30% hit excluded after calendar deadline; sealed forecast and reference price protected: PASS');
