import fs from 'node:fs/promises';
import { FactoryApiClient } from './client.mjs';

const client=new FactoryApiClient();
const plan=JSON.parse(await fs.readFile('data/world-fill-plan.json','utf8'));
const statePath='research/output/world-fill-state.json';
const signalPath='research/output/market-handoff-signal.json';
const latestExpectedTradingDate=(()=>{const d=new Date();do{d.setUTCDate(d.getUTCDate()-1)}while(d.getUTCDay()===0||d.getUTCDay()===6);return d.toISOString().slice(0,10)})();

async function inspect(m){
 const raw=JSON.parse(await fs.readFile(`data/euronext-${m.code}.json`,'utf8'));const shares=raw.shares||raw.instruments||[];
 let complete=0,missing=0,invalid=0;
 for(const s of shares){try{const h=await client.historyCoverage(s.isin),bars=h?.bars||h?.history||h?.data||[],count=Number(h?.coverage?.recordCount||bars.length||0),last=String(h?.coverage?.lastDate||bars.at(-1)?.date||'').slice(0,10);if(!count)missing++;else if(!last||last<latestExpectedTradingDate)invalid++;else complete++;}catch{missing++;}}
 return {catalog:shares.length,complete,missing,invalid,ready:shares.length>0&&complete===shares.length&&missing===0&&invalid===0};
}
let state={version:3,markets:{}};try{state=JSON.parse(await fs.readFile(statePath,'utf8'));}catch{}
const requested=process.env.MARKET_MIC;
let current=requested?plan.markets.find(x=>x.mic===requested):null;
if(!current){
 const completed=[...plan.markets].reverse().find(x=>x.state==='COMPLETE');
 current=completed||plan.markets[0];
}
if(!current)throw new Error('Geen huidige markt');
const result=await inspect(current);
let next=null;
if(result.ready){
 const idx=plan.markets.findIndex(x=>x.mic===current.mic);
 next=plan.markets.slice(idx+1).find(x=>x.state==='WAITING')||null;
}
const signal={version:2,type:result.ready?(next?'ACTIVATE_NEXT_MARKET':'WORLD_PLAN_COMPLETE'):'KEEP_FILLING_CURRENT_MARKET',emittedAt:new Date().toISOString(),current:{mic:current.mic,code:current.code,name:current.name,...result},next:next?{mic:next.mic,code:next.code,name:next.name}:null,visibleOnPublicSite:false};
state.updatedAt=signal.emittedAt;state.activeMic=next?.mic||current.mic;state.nextMic=next?plan.markets.slice(plan.markets.findIndex(x=>x.mic===next.mic)+1).find(x=>x.state==='WAITING')?.mic||null:null;state.markets||={};state.markets[current.mic]={...(state.markets[current.mic]||{}),state:result.ready?'COMPLETE':'FILLING',...result};if(next)state.markets[next.mic]={...(state.markets[next.mic]||{}),state:'SOURCE_RESEARCH',activatedAt:signal.emittedAt,activatedBy:`handoff:${current.mic}`};
await fs.mkdir('research/output',{recursive:true});await fs.writeFile(signalPath,JSON.stringify(signal,null,2));await fs.writeFile(statePath,JSON.stringify(state,null,2));console.log(JSON.stringify(signal,null,2));if(result.ready&&next)console.log(`KOERSPLEIN_HANDOFF=${next.mic}`);
