import fs from 'node:fs/promises';import {spawnSync} from 'node:child_process';
const mic=process.env.MARKET_MIC;if(!mic)throw Error('MARKET_MIC ontbreekt');
const run=(machine,file)=>{const r=spawnSync(process.execPath,[file],{stdio:'inherit',env:{...process.env,MARKET_MIC:mic}});if(r.status!==0)throw Error(`${machine} faalde voor ${mic}: ${file}`);return {machine,file,status:'PASS'}};
const steps=[
 ['M01','scripts/research/complete-market-gate.mjs'],
 ['M02','scripts/research/universal-opportunity-map.mjs'],
 ['M03-M10-blind','scripts/research/universal-market-machine1.mjs'],
 ['M07-relative','scripts/research/universal-relative-specialist.mjs'],
 ['M03-diagnostic','scripts/research/independent-market-judge.mjs']
];
const results=[];for(const [m,f] of steps)results.push(run(m,f));
const raw=await fs.readFile(`research/output/${mic}/machine1-summary.json`,'utf8');const coverage=JSON.parse(raw);
const quality={observations:coverage.observations||0,usableInstruments:coverage.usableInstruments||0,failed:coverage.failed||0,skippedMissingIsin:coverage.skippedMissingIsin||0,insufficientHistory:coverage.insufficientHistory||0,historyCoverageFile:coverage.historyCoverageFile||null,independentJudgeExecuted:true,outOfSampleValidated:false,holdoutValidated:false,allElevenMachinesCompared:false};
const qualityIssues=[];
if(quality.observations<=0) qualityIssues.push('NO_HISTORICAL_OBSERVATIONS');
if(quality.usableInstruments<=0) qualityIssues.push('NO_USABLE_INSTRUMENTS');
if(quality.failed>0) qualityIssues.push('HISTORICAL_FETCH_FAILURES_'+quality.failed);
if(quality.insufficientHistory>0) console.warn('INSUFFICIENT_HISTORY_INSTRUMENTS',mic,quality.insufficientHistory);
const summary={generatedAt:new Date().toISOString(),market:mic,status:qualityIssues.length?'INCOMPLETE_HISTORICAL_COVERAGE':'BASELINE_GENERATED_NOT_INDEPENDENTLY_VALIDATED',quality,qualityIssues,results,machines:{M01:'Time Machine / frozen walk-forward',M04:'Sector & Type Specialist via provenance-safe classification',M05:'Market Regime Specialist via PIT adapter when evidence exists',M06:'Relative Winner market/peer comparison',M07:'Price & Volume Pattern 5/20/60/120/250d',M08:'Fundamental Specialist via PIT adapter when evidence exists',M09:'Anomaly Specialist',M10:'Loser Guard'},crossMarket:{M02:'Hindsight isolated from blind path',M03:'Independent Judge required before promotion',M11:'Validated-only horizon ensemble'},note:'Missing PIT evidence remains UNKNOWN; no specialist fabricates inputs.'};
await fs.mkdir(`research/output/${mic}`,{recursive:true});await fs.writeFile(`research/output/${mic}/pipeline-summary.json`,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
if(qualityIssues.length) { console.error('HISTORICAL_QUALITY_GATE_FAILED',mic,qualityIssues.join(',')); process.exitCode=1; }
