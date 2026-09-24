import fs from 'node:fs/promises';
const plan=JSON.parse(await fs.readFile('data/world-fill-plan.json','utf8'));
const max=Math.max(1,Math.min(4,Number(plan.limits?.maxMarketsActive||4)));
const adapterMics=new Set(['XMIL','XOSL','XAMS','XBRU','XPAR','XDUB','XLIS']);
const blocked=plan.markets.filter(m=>m.state==='BLOCKED').map(m=>({mic:m.mic,reason:m.blockedReason||'UNSPECIFIED'}));
const waiting=plan.markets.filter(m=>m.state==='WAITING');
const eligibleWaiting=waiting.filter(m=>adapterMics.has(m.mic));
// A quarantined market with an existing adapter is eligible for a fresh proof run.
// This is not an approval: only the canonical single writer may remove BLOCKED after
// source preflight, history and end validation all pass. Unsupported WAITING markets
// are reported but must never globally stall healthy/revalidation work.
const revalidation=plan.markets.filter(m=>m.state==='BLOCKED'&&adapterMics.has(m.mic));
const unsupportedWaiting=waiting.filter(m=>!adapterMics.has(m.mic)).map(m=>m.mic);
const candidates=[...eligibleWaiting,...revalidation];
const selected=[...new Set(candidates.map(m=>m.mic))].slice(0,max);
await fs.mkdir('research/output',{recursive:true});
await fs.writeFile('research/output/europe-parallel-selection.json',JSON.stringify({generatedAt:new Date().toISOString(),maxActive:max,selected,blocked,eligibleWaiting:eligibleWaiting.map(m=>m.mic),revalidation:revalidation.map(m=>m.mic),unsupportedWaiting,stateSource:'data/world-fill-plan.json'},null,2));
console.log(JSON.stringify(selected));
