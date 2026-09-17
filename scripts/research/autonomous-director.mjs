import fs from 'node:fs/promises';
const lib=JSON.parse(await fs.readFile('data/research-experiments.json','utf8'));
const statePath='data/research-lab/director-state.json';let state={version:1,lastRun:null,today:null,runsToday:0,lastExperiment:null,history:[],status:'READY'};try{state=JSON.parse(await fs.readFile(statePath,'utf8'))}catch{}
const today=new Date().toISOString().slice(0,10);if(state.today!==today){state.today=today;state.runsToday=0}
let latest=null;try{latest=JSON.parse(await fs.readFile('data/research-lab/latest.json','utf8'))}catch{}
if(state.runsToday>=lib.policy.maxExperimentsPerDay){state.status='BUDGET_LIMIT';state.next=null}else{
 const candidates=lib.experiments.filter(x=>x.status==='READY').sort((a,b)=>a.priority-b.priority);
 let chosen=candidates.find(x=>!(lib.policy.neverRepeatSameExperimentSameDataDate&&state.lastExperiment===x.id&&state.lastDataDate===(latest?.generatedAt||'').slice(0,10)));
 if(!chosen){state.status='HUMAN_REVIEW';state.next=null}else{state.status='EXPERIMENT_SELECTED';state.next={id:chosen.id,title:chosen.title,script:chosen.script,purpose:chosen.purpose};state.runsToday++;state.lastExperiment=chosen.id;state.lastDataDate=(latest?.generatedAt||new Date().toISOString()).slice(0,10);state.lastRun=new Date().toISOString();state.history.unshift({at:state.lastRun,experiment:chosen.id,reason:chosen.purpose});state.history=state.history.slice(0,100)}}
await fs.mkdir('data/research-lab',{recursive:true});await fs.writeFile(statePath,JSON.stringify(state,null,2));console.log(JSON.stringify(state,null,2));if(state.next)console.log(`EXPERIMENT_ID=${state.next.id}`);