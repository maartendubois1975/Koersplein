import {assessHistoricalCoverage} from './europe-historical-quality-core.mjs';
import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const mic=process.env.MARKET_MIC;if(!mic)throw Error('MARKET_MIC ontbreekt');
const run=(machine,file)=>{const r=spawnSync(process.execPath,[file],{stdio:'inherit',env:{...process.env,MARKET_MIC:mic}});if(r.status!==0)throw Error(`${machine} faalde voor ${mic}: ${file}`);return {machine,file,status:'PASS'}};
const beforeQuality=[
 ['M01','scripts/research/complete-market-gate.mjs'],
['M03-M10-blind-data-probe','scripts/research/universal-market-machine1.mjs']
];
const afterQuality=[
 ['M02','scripts/research/universal-opportunity-map.mjs'],
 ['M07-relative','scripts/research/universal-relative-specialist.mjs'],
 ['M03-diagnostic','scripts/research/independent-market-judge.mjs']
];
const results=[];
for(const [m,f] of beforeQuality)results.push(run(m,f));
const raw=await fs.readFile(`research/output/${mic}/machine1-summary.json`,'utf8');
const coverage=JSON.parse(raw);
let evidence=null;
if(coverage.historyCoverageFile==='machine1-history-coverage.json') {
  try { evidence=JSON.parse(await fs.readFile(`research/output/${mic}/machine1-history-coverage.json`,'utf8')); }
  catch(e) { console.error('MISSING_HISTORY_EVIDENCE',mic,e.message); }
}
const assessed=assessHistoricalCoverage(coverage,evidence);
const qualityIssues=[...assessed.issues];
if(Number(coverage.skippedMissingIsin??0)>0)qualityIssues.push('UNVERIFIED_ISIN_IDENTITIES_'+coverage.skippedMissingIsin);
if(coverage.historyCoverageFile!=='machine1-history-coverage.json')qualityIssues.push('MISSING_HISTORY_PROVENANCE_REPORT');
if(qualityIssues.length===0) {
  for(const [m,f] of afterQuality)results.push(run(m,f));
} else {
  for(const [m,f] of afterQuality)results.push({machine:m,file:f,status:'SKIPPED_HISTORY_QUALITY_GATE'});
}
const quality={observations:coverage.observations??0,usableInstruments:coverage.usableInstruments??0,failed:coverage.failed??0,skippedMissingIsin:coverage.skippedMissingIsin??0,insufficientHistory:coverage.insufficientHistory??0,historyCoverageFile:coverage.historyCoverageFile??null,independentJudgeExecuted:qualityIssues.length===0,outOfSampleValidated:false,holdoutValidated:false,allElevenMachinesCompared:false,catalogInstruments:assessed.instruments,coverageFraction:assessed.instruments>0?assessed.usable/assessed.instruments:0};
const summary={generatedAt:new Date().toISOString(),market:mic,status:qualityIssues.length?'INCOMPLETE_HISTORICAL_COVERAGE':'BASELINE_GENERATED_NOT_INDEPENDENTLY_VALIDATED',quality,qualityIssues,results,machines:{M01:'Time Machine / frozen walk-forward',M04:'Sector & Type Specialist via provenance-safe classification',M05:'Market Regime Specialist via PIT adapter when evidence exists',M06:'Relative Winner market/peer comparison',M07:'Price & Volume Pattern 5/20/60/120/250d',M08:'Fundamental Specialist via PIT adapter when evidence exists',M09:'Anomaly Specialist',M10:'Loser Guard'},crossMarket:{M02:'Hindsight isolated from blind path',M03:'Independent Judge required before promotion',M11:'Validated-only horizon ensemble'},note:'Missing PIT evidence remains UNKNOWN; no specialist fabricates inputs.'};
await fs.mkdir(`research/output/${mic}`,{recursive:true});
await fs.writeFile(`research/output/${mic}/pipeline-summary.json`,JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
if(qualityIssues.length){console.error('HISTORICAL_QUALITY_GATE_FAILED',mic,qualityIssues.join(','));process.exitCode=1;}
