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
const leaderboard=[];
const promotionRules={minSelected:500,minDistinctDates:100,minExcessReturn:0.01,requireIndependentHoldout:true};
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
  output.push({horizonMonths:h,model:name,holdoutStart,holdoutReserved:reserved.length,dates:byDev.size,selected:selected.length,meanTop5Return:mean(selected.map(x=>x.realized[k])),meanUniverseReturn:mean(baseline.map(x=>x.realized[k])),targets:Object.fromEntries(targets.map(t=>[t+'pct',{top5HitRate:mean(selected.map(x=>Number(x.realized[k]>=t/100))),universeHitRate:mean(baseline.map(x=>Number(x.realized[k]>=t/100)))}])),researchOnly:true});
 }
 const candidates=output.filter(x=>x.horizonMonths===h&&x.selected>=100&&x.dates>=24).map(x=>({...x,excessReturn:x.meanTop5Return-x.meanUniverseReturn})).sort((a,b)=>b.excessReturn-a.excessReturn);
 const leader=candidates[0];const developmentQualified=Boolean(leader&&leader.selected>=promotionRules.minSelected&&leader.dates>=promotionRules.minDistinctDates&&leader.excessReturn>=promotionRules.minExcessReturn);
 leaderboard.push({horizonMonths:h,developmentLeader:leader?.model||null,developmentExcessReturn:leader?.excessReturn??null,comparedModels:candidates.length,developmentQualified,holdoutEvaluated:false,promotedToProduction:false,decision:developmentQualified?'AWAITING_INDEPENDENT_HOLDOUT':'REJECTED_DEVELOPMENT_GATE'});
}
const report={market:'XAMS',status:'EXPLORATORY_DEVELOPMENT_ONLY_NOT_OOS_VALIDATED',warning:'All models compared on development period; selection is NOT independent. Two calendar years of matured labels reserved per horizon. Holdout remains unused.',models:Object.keys(models),sectorCoverage:'Not evaluated; sector classifications require point-in-time validation',results:output,leaderboard,promotionRules};
await fs.writeFile('research/output/amsterdam-model-arena.json',JSON.stringify(report,null,2));
console.log('AMSTERDAM_MODEL_ARENA '+JSON.stringify({models:report.models,rows:output.length,leaderboard,first:output[0]}));
