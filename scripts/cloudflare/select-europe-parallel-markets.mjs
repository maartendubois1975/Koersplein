import fs from 'node:fs/promises';
const plan=JSON.parse(await fs.readFile('data/world-fill-plan.json','utf8'));
const max=Math.max(1,Math.min(4,Number(plan.limits?.maxMarketsActive||4)));
const adapterMics=new Set(['XMIL','XOSL','XAMS','XBRU','XPAR','XDUB','XLIS']);
// Markets that have a proven external access gate are quarantined in the source registry even if world-fill-plan still says WAITING.
const registry=JSON.parse(await fs.readFile('data/market-source-registry.json','utf8'));
const externallyBlocked=new Set(Object.entries(registry.markets||{}).filter(([,r])=>r?.status==='BLOCKED').map(([mic])=>mic));
const blocked=plan.markets.filter(m=>m.state==='BLOCKED').map(m=>({mic:m.mic,reason:m.blockedReason||'UNSPECIFIED'}));
const waiting=plan.markets.filter(m=>m.state==='WAITING');
const eligibleWaiting=waiting.filter(m=>adapterMics.has(m.mic)&&!externallyBlocked.has(m.mic));
// BLOCKED is a real quarantine. Repeated proof runs with an unchanged failure
// fingerprint waste capacity and can never heal a missing source. A quarantined
// market is re-enabled only by an explicit structural repair that first changes
// its canonical state/evidence. The normal selector therefore only schedules WAITING.
const unsupportedWaiting=waiting.filter(m=>!adapterMics.has(m.mic)).map(m=>m.mic);
const selected=[...new Set(eligibleWaiting.map(m=>m.mic))].slice(0,max);
await fs.mkdir('research/output',{recursive:true});
await fs.writeFile('research/output/europe-parallel-selection.json',JSON.stringify({generatedAt:new Date().toISOString(),maxActive:max,selected,blocked,eligibleWaiting:eligibleWaiting.map(m=>m.mic),unsupportedWaiting,stateSource:'data/world-fill-plan.json',quarantinePolicy:'BLOCKED_NOT_AUTO_SELECTED'},null,2));
console.log(JSON.stringify(selected));
