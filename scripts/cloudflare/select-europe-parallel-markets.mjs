import fs from 'node:fs/promises';
const plan=JSON.parse(await fs.readFile('data/world-fill-plan.json','utf8'));
const max=Math.max(1,Math.min(4,Number(plan.limits?.maxMarketsActive||4)));
let state={markets:{}};try{state=JSON.parse(await fs.readFile('research/output/world-fill-state.json','utf8'));}catch{}
const activeStates=new Set(['SOURCE_RESEARCH','ACTIVE','FILLING','READY_FOR_VALIDATION']);
const active=plan.markets.filter(m=>activeStates.has(state.markets?.[m.mic]?.state||m.state)).map(m=>m.mic);
const slots=Math.max(0,max-active.length);
const adapterMics=new Set(['XMIL','XOSL','XAMS','XBRU','XPAR','XDUB','XLIS']);
const next=plan.markets.filter(m=>m.state==='WAITING'&&!active.includes(m.mic)&&adapterMics.has(m.mic)).slice(0,slots).map(m=>m.mic);
const selected=[...active,...next].slice(0,max);
await fs.mkdir('research/output',{recursive:true});
await fs.writeFile('research/output/europe-parallel-selection.json',JSON.stringify({generatedAt:new Date().toISOString(),maxActive:max,active,next,selected},null,2));
console.log(JSON.stringify(selected));
