import fs from 'node:fs/promises';import {spawnSync} from 'node:child_process';
const mic=process.env.MARKET_MIC;if(!mic)throw Error('MARKET_MIC ontbreekt');
const run=(machine,file)=>{const r=spawnSync(process.execPath,[file],{stdio:'inherit',env:{...process.env,MARKET_MIC:mic}});if(r.status!==0)throw Error(`${machine} faalde voor ${mic}: ${file}`);return {machine,file,status:'PASS'}};
const steps=[
 ['M01','scripts/research/complete-market-gate.mjs'],
 ['M02','scripts/research/universal-opportunity-map.mjs'],
 ['M03-M10-blind','scripts/research/universal-market-machine1.mjs'],
 ['M07-relative','scripts/research/universal-relative-specialist.mjs']
];
const results=[];for(const [m,f] of steps)results.push(run(m,f));
const summary={generatedAt:new Date().toISOString(),market:mic,status:'BLIND_SPECIALIST_PIPELINE_COMPLETE',results,machines:{M01:'Time Machine / frozen walk-forward',M04:'Sector & Type Specialist via provenance-safe classification',M05:'Market Regime Specialist via PIT adapter when evidence exists',M06:'Relative Winner market/peer comparison',M07:'Price & Volume Pattern 5/20/60/120/250d',M08:'Fundamental Specialist via PIT adapter when evidence exists',M09:'Anomaly Specialist',M10:'Loser Guard'},crossMarket:{M02:'Hindsight isolated from blind path',M03:'Independent Judge required before promotion',M11:'Validated-only horizon ensemble'},note:'Missing PIT evidence remains UNKNOWN; no specialist fabricates inputs.'};
await fs.mkdir(`research/output/${mic}`,{recursive:true});await fs.writeFile(`research/output/${mic}/pipeline-summary.json`,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
