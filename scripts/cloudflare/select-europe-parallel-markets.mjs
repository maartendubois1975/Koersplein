import fs from 'node:fs/promises';
const plan=JSON.parse(await fs.readFile('data/world-fill-plan.json','utf8'));
const max=Math.max(1,Math.min(4,Number(plan.limits?.maxMarketsActive||4)));
const adapterMics=new Set(['XMIL','XOSL','XAMS','XBRU','XPAR','XDUB','XLIS','XETR']);
const registry=JSON.parse(await fs.readFile('data/market-source-registry.json','utf8'));
const blocked=plan.markets.filter(m=>m.state==='BLOCKED').map(m=>({mic:m.mic,reason:m.blockedReason||'UNSPECIFIED'}));
const candidates=plan.markets.filter(m=>m.state!=='COMPLETE'&&adapterMics.has(m.mic));
const eligible=candidates.filter(m=>{
  const r=registry.markets?.[m.mic];
  if(m.state==='WAITING' && r?.status!=='BLOCKED') return true;
  // A proven structural source-family expansion may get exactly one new preflight.
  // This is not an endless retry: once the current four-family audit has been
  // recorded, an unchanged failure remains quarantined.
  if(m.state==='BLOCKED' || r?.status==='BLOCKED'){
    const reason=r?.blockedReason||m.blockedReason;
    const tested=Number(r?.discovery?.sourceCountTested||0);
    return reason==='SOURCE_PREFLIGHT_GATE' && tested<4;
  }
  return false;
});
const unsupportedWaiting=plan.markets.filter(m=>m.state==='WAITING'&&!adapterMics.has(m.mic)).map(m=>m.mic);
const selected=[...new Set(eligible.map(m=>m.mic))].slice(0,max);
await fs.mkdir('research/output',{recursive:true});
await fs.writeFile('research/output/europe-parallel-selection.json',JSON.stringify({generatedAt:new Date().toISOString(),maxActive:max,selected,blocked,eligible:eligible.map(m=>m.mic),unsupportedWaiting,stateSource:'data/world-fill-plan.json',quarantinePolicy:'BLOCKED_RETEST_ONLY_AFTER_PROVEN_SOURCE_FAMILY_EXPANSION'},null,2));
console.log(JSON.stringify(selected));
