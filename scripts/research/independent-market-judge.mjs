import fs from 'node:fs/promises';
import {chronologicalExamFolds,benchmarkScores,rankingMetrics} from './historical-exam-core.mjs';
const mic=process.env.MARKET_MIC;if(!mic)throw Error('MARKET_MIC ontbreekt');
const dir=`research/output/${mic}`;
const raw=await fs.readFile(`${dir}/machine1-results.jsonl`,'utf8');
const rows=raw.split(/\r?\n/).filter(Boolean).map(x=>JSON.parse(x));
const report={generatedAt:new Date().toISOString(),market:mic,judge:'M03_INDEPENDENT_BASELINE_DIAGNOSTIC',status:'NOT_VALIDATED',observations:rows.length,horizons:{},limitations:['Only M01 baseline predictions exist; not an 11-machine competition','No immutable precommitted forecasts verified','No independent untouched holdout promotion authorized','Provisional symbol identities excluded from validation metrics; historical universe membership remains unverified']};
for(const h of [3,6,12,24]){
 const k=`${h}m`;
 const eligible=rows.filter(r=>Number.isFinite(r.predictions?.[k])&&Number.isFinite(r.realized?.[k])&&Date.parse(r.predictionDate)<Date.now()-h*30.4375*86400000);
 const verified=eligible.filter(r=>r.provisionalIdentity!==true);
 const provisional=eligible.length-verified.length;
 const exam=chronologicalExamFolds(verified,{horizonMonths:h,embargoMonths:h,holdoutMonths:24});
 const scores=exam.folds.map(f=>rankingMetrics(f.test.map(r=>({prediction:r.predictions[k],actual:r.realized[k]}))));
 const holdoutRanking=rankingMetrics(exam.holdout.map(r=>({prediction:r.predictions[k],actual:r.realized[k]})));
 const holdoutBenchmark=benchmarkScores(exam.holdout,h);
 report.horizons[k]={maturedSamples:eligible.length,verifiedIdentitySamples:verified.length,provisionalIdentityExcluded:provisional,folds:exam.folds.length,holdoutSamples:exam.holdout.length,foldMetrics:scores,developmentBenchmark:benchmarkScores(verified.filter(r=>!exam.holdout.includes(r)),h),holdoutRanking,holdoutBenchmark,validated:false};
}
await fs.writeFile(`${dir}/independent-judge-diagnostic.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({market:mic,status:report.status,observations:rows.length,horizons:Object.fromEntries(Object.entries(report.horizons).map(([k,v])=>[k,{samples:v.maturedSamples,folds:v.folds}]))}));
