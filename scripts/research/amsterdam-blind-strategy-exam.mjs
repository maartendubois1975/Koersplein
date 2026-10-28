import fs from 'node:fs/promises';
const root='research/output/';
const report=JSON.parse(await fs.readFile(root+'amsterdam-model-arena.json','utf8'));
const rows=(await fs.readFile(root+'amsterdam-machine1-results.jsonl','utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
const score=(model,r,h)=>model==='momentum3m'?r.availableSignals?.momentum3m:model==='momentum6m'?r.availableSignals?.momentum6m:model==='momentum12m'?r.availableSignals?.momentum12m:model==='reversal3m'?-r.availableSignals?.momentum3m:r.predictions?.['3m'];
const result=[];
for(const horizon of [3,6,12,24]){
 const k=horizon+'m',leader=report.leaderboard.find(x=>x.horizonMonths===horizon);
 const start=report.results.find(x=>x.horizonMonths===horizon)?.holdoutStart;
 const holdout=rows.filter(x=>x.predictionDate>=start&&Number.isFinite(x.realized?.[k]));
 const days=Map.groupBy(holdout,x=>x.predictionDate);
 const selected=[],unconditional=[],all=[],skipped=[];
 const equalDateStrategy=[],equalDateFixed=[],equalDateUniverse=[];
 const paired=[];
 let strategyPositions=0,fixedPositions=0;
 const counts={rising:0,falling:0,sideways:0,unknown:0};
 for(const [date,day] of days){
  const signals=day.map(x=>x.availableSignals?.momentum3m).filter(Number.isFinite);
  const momentum=mean(signals),regime=signals.length>=5?(momentum>0.05?'rising':momentum< -0.05?'falling':'sideways'):'unknown';
  counts[regime]++;
  all.push(...day.map(x=>x.realized[k]));
  equalDateUniverse.push(mean(day.map(x=>x.realized[k])));
  const fixed=leader.developmentLeader;
  if(fixed){const picks=day.filter(x=>Number.isFinite(score(fixed,x,horizon))).sort((a,b)=>score(fixed,b,horizon)-score(fixed,a,horizon)).slice(0,5).map(x=>x.realized[k]);unconditional.push(...picks);fixedPositions+=picks.length;equalDateFixed.push(mean(picks)??0)}else equalDateFixed.push(0);
  const rule=report.regimeRecommendations.find(x=>x.horizonMonths===horizon&&x.regime===regime);
  if(!leader.developmentQualified||!rule?.regimeQualified||!rule.developmentLeader){skipped.push({date,regime,reason:'NO_DEVELOPMENT_QUALIFIED_MODEL'});equalDateStrategy.push(0);paired.push({date,strategy:0,fixed:equalDateFixed.at(-1),universe:equalDateUniverse.at(-1),strategyPositions:0,fixedPositions:fixed?Math.min(5,day.filter(x=>Number.isFinite(score(fixed,x,horizon))).length):0});continue}
  const model=rule.developmentLeader;
  const picks=day.filter(x=>Number.isFinite(score(model,x,horizon))).sort((a,b)=>score(model,b,horizon)-score(model,a,horizon)).slice(0,5).map(x=>x.realized[k]);
  selected.push(...picks);strategyPositions+=picks.length;equalDateStrategy.push(mean(picks)??0);paired.push({date,strategy:equalDateStrategy.at(-1),fixed:equalDateFixed.at(-1),universe:equalDateUniverse.at(-1),strategyPositions:picks.length,fixedPositions:fixed?Math.min(5,day.filter(x=>Number.isFinite(score(fixed,x,horizon))).length):0});
 }
 const strategy=mean(selected),baseline=mean(all),always=mean(unconditional);
 const pairedDifferences=paired.map(x=>x.strategy-x.fixed);
 const costsBps=[0,10,25,50];
 const costSensitivity=costsBps.map(bps=>{const fee=bps/10000;const strategyNet=mean(paired.map(x=>x.strategy-(x.strategyPositions>0?fee:0)));const fixedNet=mean(paired.map(x=>x.fixed-(x.fixedPositions>0?fee:0)));return {roundTripCostBps:bps,strategyNetEqualDate:strategyNet,fixedNetEqualDate:fixedNet,netExcessVsFixed:strategyNet-fixedNet,assumption:'Round-trip fee per date with one or more positions, not per stock; excludes turnover and overlapping holdings'}});
 const positivePairedDates=pairedDifferences.filter(x=>x>0).length;
 const nonzeroPairedDates=pairedDifferences.filter(x=>x!==0).length;
 const yearlyPairs=Map.groupBy(paired,x=>x.date.slice(0,4));
 const yearlyExcess=[...yearlyPairs.entries()].map(([year,dates])=>({year,dates:dates.length,excessVsFixed:mean(dates.map(x=>x.strategy-x.fixed))}));
 const positiveYears=yearlyExcess.filter(x=>x.excessVsFixed>0).length;
 const requiredPositiveYears=Math.ceil(yearlyExcess.length*0.6);
 const outperformsFixed=mean(pairedDifferences)>0;
 const stableByYear=yearlyExcess.length>=3&&positiveYears>=requiredPositiveYears;
 const strategyGate=leader.developmentQualified&&outperformsFixed&&stableByYear?'RESEARCH_CANDIDATE_REQUIRES_PORTFOLIO_TEST':'REJECTED_BLIND_STRATEGY_GATE';
 result.push({horizonMonths:horizon,holdoutStart:start,holdoutDates:days.size,regimeDates:counts,investedSelections:selected.length,strategyPositions,fixedPositions,skippedDates:skipped.length,costSensitivity,strategyGate,positiveYears,requiredPositiveYears,stableByYear,outperformsFixed,positivePairedDates,nonzeroPairedDates,positivePairedShare:nonzeroPairedDates?positivePairedDates/nonzeroPairedDates:null,yearlyExcess,coverage:days.size?(days.size-skipped.length)/days.size:null,equalDateStrategyReturnWithCashZero:mean(equalDateStrategy),equalDateFixedModelReturnWithCashZero:mean(equalDateFixed),equalDateUniverseReturn:mean(equalDateUniverse),equalDateExcessVsFixed:mean(equalDateStrategy)-mean(equalDateFixed),equalDateExcessVsUniverse:mean(equalDateStrategy)-mean(equalDateUniverse),meanSelectedReturn:strategy,meanUniverseReturn:baseline,meanUnconditionalLeaderReturn:always,excessVsUniverse:strategy===null||baseline===null?null:strategy-baseline,excessVsUnconditional:strategy===null||always===null?null:strategy-always,decision:'INDEPENDENT_HOLDOUT_AUDIT_ONLY_NO_PRODUCTION_PROMOTION',caveat:'Equal-date metrics assign 0 to no-pick dates and are NOT a tradable compounded portfolio: forward holding periods overlap, cash yield assumed zero, and real transaction costs, delistings and survivorship bias remain unresolved.'});
}
const out={market:'XAMS',strategyFrozenFrom:'amsterdam-model-arena.json',status:'FIRST_HOLDOUT_EVALUATION_RESEARCH_ONLY',warning:'Do not optimize thresholds or select models using these holdout results. No live publication.',results:result};
await fs.writeFile(root+'amsterdam-blind-strategy-exam.json',JSON.stringify(out,null,2));
console.log('AMSTERDAM_BLIND_STRATEGY_EXAM '+JSON.stringify(result));
