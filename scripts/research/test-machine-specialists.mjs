import assert from 'node:assert/strict';import {pricePatternFeatures,anomalyLoserGuard,peerRelativeFeatures} from './machine-specialists-core.mjs';
const bars=Array.from({length:300},(_,i)=>({date:new Date(Date.UTC(2020,0,1+i)).toISOString().slice(0,10),close:100+i*.2}));
const f=pricePatternFeatures(bars,299);assert(f&&f.momentum12m>0);assert.equal(anomalyLoserGuard(f).guardActive,false);
const a={features:{momentum6m:.3}},b={features:{momentum6m:.1}},c={features:{momentum6m:.2}};const p=peerRelativeFeatures(a,[a,b,c]);assert.equal(p.peerCount,2);assert(p.relativeMomentum6m>0);assert(p.percentile===1);
const crash=anomalyLoserGuard({volatility126:.08,distance52wHigh:-.5,momentum3m:-.3,acceleration:-.25});assert.equal(crash.warnings.length,4);
console.log(JSON.stringify({status:'PASS',pattern:f,peer:p,crash}));
