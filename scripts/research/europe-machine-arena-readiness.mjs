import fs from 'node:fs/promises';
const plan=JSON.parse(await fs.readFile('data/world-fill-plan.json','utf8'));
const contract=JSON.parse(await fs.readFile('research/machine-arena-europe-v1.json','utf8'));
const complete=plan.markets.filter(x=>x.state==='COMPLETE');
if(complete.length!==31) throw Error(`EUROPE_NOT_COMPLETE_${complete.length}_OF_31`);
const required=['M01','M02','M03','M04','M05','M06','M07','M08','M09','M10','M11'];
const ids=contract.machines.map(x=>x.id);
for(const id of required) if(!ids.includes(id)) throw Error(`MACHINE_MISSING_${id}`);
for(const m of contract.machines) if(m.id!=='M02'&&m.futureAccess) throw Error(`FUTURE_LEAK_CONTRACT_${m.id}`);
if(!contract.hardGates.pointInTimeOnly||!contract.hardGates.predictionsImmutable||!contract.hardGates.independentOutOfSampleValidation) throw Error('ARENA_HARD_GATES_DISABLED');
const existing={
 pointInTime:'scripts/research/pit-core.mjs',
 blindTimeMachine:'scripts/research/machine1-v2-core.mjs',
 hindsight:'scripts/research/hindsight-postmortem.mjs',
 specialists:'scripts/research/machine-specialists-core.mjs',
 pitSpecialists:'scripts/research/pit-specialists-core.mjs',
 ensemble:'scripts/research/ensemble-horizon-core.mjs',
 judge:'scripts/research/machine3-validation-core.mjs',
 relative:'scripts/research/relative-core.mjs',
 regime:'scripts/research/macro-regime-core.mjs',
 fundamentals:'scripts/research/fundamentals-core.mjs',
 modelCompetition:'scripts/research/model-arena.mjs',
 europePipeline:'scripts/research/complete-market-pipeline.mjs'
};
for(const [name,path] of Object.entries(existing)){try{await fs.access(path)}catch{throw Error(`FOUNDATION_MISSING_${name}_${path}`)}}
const report={generatedAt:new Date().toISOString(),status:'READY_TO_EXECUTE_PHASE_1',markets:complete.map(x=>x.mic),marketCount:complete.length,machineCount:contract.machines.length,horizonsMonths:contract.horizonsMonths,foundations:existing,nextPhase:{name:'historical-Europe-baseline',purpose:'Run frozen blind forecasts across all COMPLETE European markets, then score outcomes separately; hindsight remains isolated.',customerRanking:'Top candidates separately for 3/6/12/24 months; no 0-100 score.'}};
await fs.mkdir('research/output/machine-arena',{recursive:true});
await fs.writeFile('research/output/machine-arena/readiness.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
