import fs from 'node:fs/promises';
import {chronologicalExamFolds} from './historical-exam-core.mjs';
const input='research/output/amsterdam-machine1-results.jsonl';
const raw=(await fs.readFile(input,'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);
const horizons=[3,6,12,24],targets=[10,20,30];
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const reports=[];
for(const h of horizons){
 const key=h+'m';
 const matured=raw.filter(r=>Number.isFinite(r.predictions?.[key])&&Number.isFinite(r.realized?.[key]));
 const {folds,holdout}=chronologicalExamFolds(matured,{trainMonths:60,testMonths:12,embargoMonths:0,holdoutMonths:24,horizonMonths:h});
 const exams=folds.map((fold,i)=>{
  const byDate=Map.groupBy(fold.test,r=>r.predictionDate);
  const selected=[...byDate.values()].flatMap(rows=>[...rows].sort((a,b)=>b.predictions[key]-a.predictions[key]).slice(0,5));
  const baseline=fold.test;
  return {fold:i+1,trainSize:fold.train.length,testSize:baseline.length,selectedSize:selected.length,dates:byDate.size,top5MeanReturn:mean(selected.map(x=>x.realized[key])),universeMeanReturn:mean(baseline.map(x=>x.realized[key])),targets:Object.fromEntries(targets.map(t=>[t+'pct',{top5HitRate:mean(selected.map(x=>x.realized[key]>=t/100?1:0)),universeHitRate:mean(baseline.map(x=>x.realized[key]>=t/100?1:0))}]))};
 });
 reports.push({horizonMonths:h,maturedObservations:matured.length,folds:exams,holdoutReserved:holdout.length,independentHoldoutTested:false,validatedForPublication:false,reason:exams.length?'REQUIRES_INDEPENDENT_HOLDOUT_AND_MULTIPLE_MODEL_COMPARISON':'INSUFFICIENT_CHRONOLOGICAL_FOLDS'});
}
const report={market:'XAMS',model:'machine1-price-baseline-v1',status:'RESEARCH_ONLY_NOT_INVESTMENT_ADVICE',totalObservations:raw.length,report:reports};
await fs.writeFile('research/output/amsterdam-machine1-judge.json',JSON.stringify(report,null,2));
console.log('AMSTERDAM_BASELINE_JUDGE '+JSON.stringify(report));
if(!raw.length)process.exitCode=1;
