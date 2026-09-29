import fs from 'node:fs/promises';import {spawnSync} from 'node:child_process';
const mic=process.env.MARKET_MIC;if(!mic)throw Error('MARKET_MIC ontbreekt');
const run=(machine,file)=>{const r=spawnSync(process.execPath,[file],{stdio:'inherit',env:{...process.env,MARKET_MIC:mic}});if(r.status!==0)throw Error(`${machine} faalde voor ${mic}: ${file}`);return {machine,file,status:'PASS'}};
const steps=[
 ['M01','scripts/research/complete-market-gate.mjs'],
 ['M02','scripts/research/universal-opportunity-map.mjs'],
 ['M03-M07','scripts/research/universal-market-machine1.mjs']
];
const results=[];for(const [m,f] of steps)results.push(run(m,f));
const summary={generatedAt:new Date().toISOString(),market:mic,status:'CORE_BLIND_PIPELINE_COMPLETE',results,contracts:{M01:'catalog/data truth',M02:'opportunity census',M03:'point-in-time walk-forward',M04:'price feature factory',M05:'frozen baseline predictions',M06:'realized-vs-predicted scoring dataset',M07:'blind chronological test'},note:'M08 live scanner is downstream-only; M09/M10 are run in the cross-market completion workflow after every market core is frozen.'};
await fs.mkdir(`research/output/${mic}`,{recursive:true});await fs.writeFile(`research/output/${mic}/pipeline-summary.json`,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
