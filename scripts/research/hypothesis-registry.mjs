import { sha256 } from './pit-core.mjs';

export function registerHypothesis(input) {
  const required=['title','origin','signalNames','target','horizonsMonths','discoveryUniverse','discoveryPeriod','testPlan'];
  for (const k of required) if (input[k]==null) throw new Error(`Hypothese ontbreekt: ${k}`);
  const core={...input,status:'PROPOSED',createdAt:input.createdAt||new Date().toISOString(),mayTeachMachine1:false};
  return {...core,hypothesisId:input.hypothesisId||sha256(core)};
}

export function recordTest(hypothesis,test) {
  if (!hypothesis?.hypothesisId) throw new Error('hypothesisId vereist');
  const allowed=['REJECTED','INCONCLUSIVE','SURVIVED_DISCOVERY','READY_FOR_INDEPENDENT_TEST'];
  if (!allowed.includes(test.status)) throw new Error('Ongeldige teststatus');
  return {...hypothesis,tests:[...(hypothesis.tests||[]),{...test,recordedAt:new Date().toISOString()}],status:test.status,mayTeachMachine1:false};
}

export function failedHypothesisLedger(hypotheses) {
  return hypotheses.filter(h=>h.status==='REJECTED').map(h=>({hypothesisId:h.hypothesisId,title:h.title,tests:h.tests||[]}));
}

export const RULES = Object.freeze({
  neverDeleteFailure:true,
  countAllTestsForMultipleTesting:true,
  discoveryCannotPromoteToMachine1:true,
  independentBlock11Required:true,
  holdoutCannotBeUsedForTuning:true,
  namedSignalsOnly:true
});
