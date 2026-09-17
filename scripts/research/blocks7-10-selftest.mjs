import { freezePrediction } from './machine1-v2-core.mjs';
import { buildForensicCase } from './machine2-forensic-v2.mjs';
import { registerHypothesis, recordTest, failedHypothesisLedger } from './hypothesis-registry.mjs';

const base={entityId:'X',family:'PRICE',signalName:'momentum12m',validTime:'2020-12-31T00:00:00Z',retrievedTime:'2026-01-01T00:00:00Z',vintageId:'v1',sourceId:'S',publisher:'S',sourceTier:'A',licenseStatus:'PUBLIC',ingestionAdapter:'test',adapterVersion:'1',timestampProven:true,pointInTimeSafe:true,trainingEligible:true,missing:false,rawValue:.2,publishedTime:'2021-01-01T07:00:00Z',tradableTime:'2021-01-01T08:00:00Z'};
const future={...base,evidenceId:'future',rawValue:.9,publishedTime:'2021-03-01T07:00:00Z',tradableTime:'2021-03-01T08:00:00Z'};
const known={...base,evidenceId:'known'};
const prediction=freezePrediction({entityId:'X',predictionTime:'2021-02-01T00:00:00Z',modelVersion:'test-v1',evidenceRows:[known,future],predictor:({horizonMonths})=>({expectedReturn:.01*horizonMonths,medianReturn:.005*horizonMonths,probabilityPositive:.55,downsideProbability:.15,uncertainty:.3})});
if (prediction.evidenceIds.includes('future')) throw new Error('Future leak in Machine 1');
const forensic=buildForensicCase({prediction,outcome:{horizonMonths:12,totalReturn:1.2},futureEvidence:[future]});
if (forensic.outcomeClass!=='EXTREME_WINNER') throw new Error('Forensic classification failed');
let h=registerHypothesis({title:'test',origin:prediction.predictionId,signalNames:['momentum12m'],target:'12m return',horizonsMonths:[12],discoveryUniverse:'X',discoveryPeriod:'2020-2021',testPlan:'untouched universe'});
h=recordTest(h,{status:'REJECTED',reason:'geen stabiele lift'});
if (h.mayTeachMachine1 || failedHypothesisLedger([h]).length!==1) throw new Error('Hypothesis gate failed');
console.log(JSON.stringify({ok:true,blocks:[7,8,9,10],checks:['blind cutoff','frozen prediction','future forensic evidence separated','extreme outcome priority','failed hypothesis retained','no direct Machine1 teaching']},null,2));
