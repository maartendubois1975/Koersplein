import { projectWorldAt, assertNoFutureLeak, sha256 } from './pit-core.mjs';

export const HORIZONS_MONTHS = [3,6,12,24];

export function freezePrediction({entityId,predictionTime,modelVersion,evidenceRows,predictor}) {
  const world = projectWorldAt(evidenceRows,predictionTime).filter(e=>e.trainingEligible);
  assertNoFutureLeak(world,predictionTime);
  const evidenceIds = world.map(e=>e.evidenceId).sort();
  const outputs = HORIZONS_MONTHS.map(horizonMonths=>{
    const distribution = predictor({entityId,predictionTime,horizonMonths,world});
    if (!distribution || !Number.isFinite(distribution.expectedReturn)) throw new Error('Predictor moet een kansverdeling/samenvatting leveren');
    return {horizonMonths,...distribution};
  });
  const frozen = {entityId,predictionTime:new Date(predictionTime).toISOString(),modelVersion,evidenceIds,outputs,createdAt:new Date().toISOString(),mutable:false};
  return {...frozen,predictionId:sha256(frozen)};
}

export function predictionContract() {
  return {
    required:['expectedReturn','medianReturn','probabilityPositive','downsideProbability','uncertainty'],
    horizons:HORIZONS_MONTHS,
    rule:'prediction wordt na creatie nooit herschreven; latere werkelijkheid is apart outcome-record'
  };
}
