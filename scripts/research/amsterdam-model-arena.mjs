import fs from 'node:fs/promises';
import {classificationFor} from './sector-classification-core.mjs';
const input='research/output/amsterdam-machine1-results.jsonl';
const rows=(await fs.readFile(input,'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);
const horizons=[3,6,12,24],targets=[10,20,30];
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const models={
 momentum3m:r=>r.availableSignals?.momentum3m,
 momentum6m:r=>r.availableSignals?.momentum6m,
 momentum12m:r=>r.availableSignals?.momentum12m,
 combinedMomentum:r=>r.predictions?.['3m'],
 reversal3m:r=>Number.isFinite(r.availableSignals?.momentum3m)?-r.availableSignals.momentum3m:null
};
const output=[];
const stability=[];
const regimes=[];
const regimeRecommendations=[];
const leaderboard=[];
const promotionRules={minSelected:500,minDistinctDates:100,minExcessReturn:0.01,minEligibleYears:3,minPositiveYearShare:0.6,requireIndependentHoldout:true};
for(const h of horizons){
 const k=h+'m',foldRows=rows.filter(r=>Number.isFinite(r.realized?.[k]));
 const dates=[...new Set(foldRows.map(x=>x.predictionDate))].sort();
 const lastDate=dates.at(-1);const holdoutStart=lastDate?new Date(Date.parse(lastDate+'T00:00:00Z')-730*86400000).toISOString().slice(0,10):'9999-12-31';
 const dev=foldRows.filter(x=>x.predictionDate<holdoutStart);
 const reserved=foldRows.filter(x=>x.predictionDate>=holdoutStart);
 for(const [name,score] of Object.entries(models)){
  const byDev=Map.groupBy(dev,r=>r.predictionDate),selected=[];
  for(const daily of byDev.values())selected.push(...daily.filter(x=>Number.isFinite(score(x))).sort((a,b)=>score(b)-score(a)).slice(0,5));
  const baseline=dev;
  const yearly=Map.groupBy(dev,r=>r.predictionDate.slice(0,4));
  const annual=[...yearly.entries()].map(([year,all])=>{const daily=Map.groupBy(all,r=>r.predictionDate),top=[];for(const day of daily.values())top.push(...day.filter(x=>Number.isFinite(score(x))).sort((a,b)=>score(b)-score(a)).slice(0,5));return {year,selected:top.length,dates:daily.size,excessReturn:top.length?mean(top.map(x=>x.realized[k]))-mean(all.map(x=>x.realized[k])):null}}).filter(x=>x.selected>=20);
  stability.push({horizonMonths:h,model:name,years:annual,positiveYears:annual.filter(x=>x.excessReturn>0).length,eligibleYears:annual.length,positiveYearShare:annual.length?annual.filter(x=>x.excessReturn>0).length/annual.length:null});
  const regimeGroups={rising:[],falling:[],sideways:[]};
  for(const day of byDev.values()){const observed=day.map(x=>Number(x.availableSignals?.momentum3m)).filter(Number.isFinite);if(observed.length<5)continue;const avg=mean(observed),regime=avg>0.05?'rising':avg< -0.05?'falling':'sideways';regimeGroups[regime].push(day)}
  for(const [regime,days] of Object.entries(regimeGroups)){const universe=days.flat(),picks=days.flatMap(day=>day.filter(x=>Number.isFinite(score(x))).sort((a,b)=>score(b)-score(a)).slice(0,5));regimes.push({horizonMonths:h,model:name,regime,dates:days.length,selected:picks.length,meanTop5Return:mean(picks.map(x=>x.realized[k])),meanUniverseReturn:mean(universe.map(x=>x.realized[k])),excessReturn:picks.length?mean(picks.map(x=>x.realized[k]))-mean(universe.map(x=>x.realized[k])):null,regimeDefinedBy:'CROSS_SECTIONAL_3M_MOMENTUM_KNOWN_AT_T',caution:'Proxy based on current-universe historical constituents, not an official market index'})}
  output.push({horizonMonths:h,model:name,holdoutStart,holdoutReserved:reserved.length,dates:byDev.size,selected:selected.length,meanTop5Return:mean(selected.map(x=>x.realized[k])),meanUniverseReturn:mean(baseline.map(x=>x.realized[k])),targets:Object.fromEntries(targets.map(t=>[t+'pct',{top5HitRate:mean(selected.map(x=>Number(x.realized[k]>=t/100))),universeHitRate:mean(baseline.map(x=>Number(x.realized[k]>=t/100)))}])),researchOnly:true});
 }
 const candidates=output.filter(x=>x.horizonMonths===h&&x.selected>=100&&x.dates>=24).map(x=>({...x,excessReturn:x.meanTop5Return-x.meanUniverseReturn})).sort((a,b)=>b.excessReturn-a.excessReturn);
 const qualify=x=>{const s=stability.find(v=>v.horizonMonths===h&&v.model===x.model);return x.selected>=promotionRules.minSelected&&x.dates>=promotionRules.minDistinctDates&&x.excessReturn>=promotionRules.minExcessReturn&&s?.eligibleYears>=promotionRules.minEligibleYears&&s?.positiveYearShare>=promotionRules.minPositiveYearShare};
 const qualified=candidates.filter(qualify);
 for(const regime of ['rising','falling','sideways']){const eligible=qualified.map(x=>({model:x.model,stats:regimes.find(v=>v.horizonMonths===h&&v.model===x.model&&v.regime===regime)})).filter(x=>x.stats?.dates>=30&&x.stats?.selected>=100&&Number.isFinite(x.stats.excessReturn)).sort((a,b)=>b.stats.excessReturn-a.stats.excessReturn);const best=eligible[0];regimeRecommendations.push({horizonMonths:h,regime,developmentLeader:best?.model||null,excessReturn:best?.stats.excessReturn??null,eligibleModels:eligible.length,minimumRegimeDates:30,minimumRegimeSelections:100,decision:'DIAGNOSTIC_ONLY_NOT_DEPLOYABLE',holdoutEvaluated:false})}
 const leader=qualified[0]||null;
 const rejectedFrontRunner=candidates[0]&&!qualify(candidates[0])?{model:candidates[0].model,excessReturn:candidates[0].excessReturn,reason:'FAILED_DEVELOPMENT_STABILITY_OR_SAMPLE_GATE'}:null;
 const leaderStability=stability.find(x=>x.horizonMonths===h&&x.model===leader?.model);
 const developmentQualified=Boolean(leader);
 leaderboard.push({horizonMonths:h,developmentLeader:leader?.model||null,developmentExcessReturn:leader?.excessReturn??null,comparedModels:candidates.length,qualifiedModels:qualified.map(x=>x.model),rejectedFrontRunner,leaderStability,developmentQualified,holdoutEvaluated:false,promotedToProduction:false,decision:developmentQualified?'AWAITING_INDEPENDENT_HOLDOUT':'REJECTED_DEVELOPMENT_GATE'});
}
const report={market:'XAMS',status:'EXPLORATORY_DEVELOPMENT_ONLY_NOT_OOS_VALIDATED',warning:'All models compared on development period; selection is NOT independent. Two calendar years of matured labels reserved per horizon. Holdout remains unused.',models:Object.keys(models),sectorCoverage:'Not evaluated; sector classifications require point-in-time validation',results:output,stability,regimes,regimeRecommendations,leaderboard,promotionRules};
await fs.writeFile('research/output/amsterdam-model-arena.json',JSON.stringify(report,null,2));
console.log('AMSTERDAM_MODEL_ARENA '+JSON.stringify({models:report.models,rows:output.length,regimeRows:regimes.length,regimeRecommendations,leaderboard,first:output[0]}));
