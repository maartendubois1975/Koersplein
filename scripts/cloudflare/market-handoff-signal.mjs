import fs from 'node:fs/promises';
import { FactoryApiClient } from './client.mjs';

const client = new FactoryApiClient();
const plan = JSON.parse(await fs.readFile('data/world-fill-plan.json','utf8'));
const signalPath = 'research/output/market-handoff-signal.json';
const statePath = 'research/output/world-fill-state.json';
const today = new Date().toISOString().slice(0,10);
const latestExpectedTradingDate=(()=>{const d=new Date(`${today}T12:00:00Z`);do{d.setUTCDate(d.getUTCDate()-1)}while(d.getUTCDay()===0||d.getUTCDay()===6);return d.toISOString().slice(0,10)})();

async function inspectMarket(m) {
  const raw = JSON.parse(await fs.readFile(`data/euronext-${m.code}.json`, 'utf8'));
  const shares = raw.shares || raw.instruments || [];
  let complete = 0, missing = 0, invalid = 0;
  const failures = [];
  for (const s of shares) {
    try {
      const h = await client.history(s.isin);
      const bars = Array.isArray(h?.bars) ? h.bars : Array.isArray(h?.history) ? h.history : Array.isArray(h?.data) ? h.data : [];
      const count=Number(h?.coverage?.recordCount||bars.length||0);
      if (!count) { missing++; failures.push({isin:s.isin, reason:'NO_HISTORY'}); continue; }
      const last = String(h?.coverage?.lastDate || bars.at(-1)?.date || bars.at(-1)?.day || '').slice(0,10);
      if (!last) { invalid++; failures.push({isin:s.isin, reason:'NO_LAST_DATE'}); continue; }
      if(last<latestExpectedTradingDate){invalid++;failures.push({isin:s.isin,reason:`STALE_HISTORY:${last}<${latestExpectedTradingDate}`});continue;}
      complete++;
    } catch (e) { missing++; failures.push({isin:s.isin, reason:e.message}); }
  }
  return {catalog:shares.length, complete, missing, invalid, checkedAt:new Date().toISOString(), today, latestExpectedTradingDate, failures:failures.slice(0,25)};
}

let state={version:2,updatedAt:null,markets:{},activeMic:null,nextMic:null};
try { state=JSON.parse(await fs.readFile(statePath,'utf8')); } catch {}
const currentMic = process.env.MARKET_MIC || state.activeMic || plan.markets.find(m=>m.state==='ACTIVE')?.mic || plan.markets[0]?.mic;
const idx = plan.markets.findIndex(m=>m.mic===currentMic);
if (idx < 0) throw new Error(`Onbekende actieve markt ${currentMic}`);
const current = plan.markets[idx];
const result = await inspectMarket(current);
const ready = result.catalog > 0 && result.complete === result.catalog && result.missing === 0 && result.invalid === 0;
const next = ready ? plan.markets[idx+1] || null : null;
const signal = {
  version:1,
  type: ready ? (next ? 'ACTIVATE_NEXT_MARKET' : 'WORLD_PLAN_COMPLETE') : 'KEEP_FILLING_CURRENT_MARKET',
  emittedAt:new Date().toISOString(),
  current:{mic:current.mic,code:current.code,name:current.name,...result},
  next:next ? {mic:next.mic,code:next.code,name:next.name} : null,
  visibleOnPublicSite:false
};
state.updatedAt=signal.emittedAt;
state.activeMic=next?.mic || current.mic;
state.nextMic=next ? plan.markets[idx+2]?.mic || null : null;
state.markets ||= {};
state.markets[current.mic]={...(state.markets[current.mic]||{}),state:ready?'COMPLETE':'FILLING',...result};
if(next) state.markets[next.mic]={...(state.markets[next.mic]||{}),state:'ACTIVE',activatedAt:signal.emittedAt,activatedBy:`handoff:${current.mic}`};
await fs.mkdir('research/output',{recursive:true});
await fs.writeFile(signalPath,JSON.stringify(signal,null,2));
await fs.writeFile(statePath,JSON.stringify(state,null,2));
console.log(JSON.stringify(signal,null,2));
if (ready && next) console.log(`KOERSPLEIN_HANDOFF=${next.mic}`);
