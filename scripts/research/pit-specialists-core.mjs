import {projectWorldAt} from './pit-core.mjs';
import {deriveMacroRegime} from './macro-regime-core.mjs';
export function specialistSnapshot(evidence,cutoff,isin){
 const world=projectWorldAt(evidence,cutoff);
 const own=world.filter(x=>x.entityId===isin);
 const fundamentals=own.filter(x=>x.family==='FUNDAMENTALS'&&x.trainingEligible);
 const macro=world.filter(x=>x.family==='MACRO'&&x.trainingEligible);
 return {fundamentals:{available:fundamentals.length>0,evidenceIds:fundamentals.map(x=>x.evidenceId),signals:Object.fromEntries(fundamentals.map(x=>[x.signalName,x.normalizedValue??x.rawValue]))},regime:{available:macro.length>0,evidenceIds:macro.map(x=>x.evidenceId),value:deriveMacroRegime(macro)}};
}