import fs from 'node:fs/promises';
import { FactoryApiClient } from './client.mjs';

const client=new FactoryApiClient();
const plan=JSON.parse(await fs.readFile('data/world-fill-plan.json','utf8'));
const statePath='research/output/world-fill-state.json';
const signalPath='research/output/market-handoff-signal.json';
// Require data through the second most recent closed trading weekday. This keeps the
// end gate strict while allowing one closed-session propagation delay between the
// market/provider and our API; runner and validator must use the identical rule.
const latestExpectedTradingDate=(()=>{const d=new Date();let closed=0;while(closed<2){d.setUTCDate(d.getUTCDate()-1);if(d.getUTCDay()!==0&&d.getUTCDay()!==6)closed++;}return d.toISOString().slice(0,10)})();

async function inspect(m){
 const raw=JSON.parse(await fs.readFile(`data/euronext-${m.code}.json`,'utf8'));const shares=raw.shares||raw.instruments||[];
 const batch=Math.max(10,Number(process.env.VALIDATION_BATCH_SIZE||25));let complete=0,missing=0,invalid=0,checked=0;const invalidItems=[],missingItems=[];
 for(let i=0;i<shares.length;i+=batch){const part=shares.slice(i,i+batch);const rows=await Promise.all(part.map(async s=>{try{const h=await client.historyCoverage(s.isin),bars=h?.bars||h?.history||h?.data||[],count=Number(h?.coverage?.recordCount||bars.length||0),last=String(h?.coverage?.lastDate||bars.at(-1)?.date||'').slice(0,10);const status=!count?'missing':(!last||last<latestExpectedTradingDate?'invalid':'complete');return {status,item:s,count,last}}catch(e){return{status:'missing',item:s,count:0,last:'',error:e.message}}}));for(const x of rows){checked++;if(x.status==='complete')complete++;else if(x.status==='invalid'){invalid++;invalidItems.push({isin:x.item.isin,symbol:x.item.symbol||x.item.ticker,name:x.item.name,lastDate:x.last,recordCount:x.count});}else{missing++;missingItems.push({isin:x.item.isin,symbol:x.item.symbol||x.item.ticker,name:x.item.name,error:x.error||null});}}console.log(JSON.stringify({validationProgress:{market:m.mic,checked,total:shares.length,complete,missing,invalid,latestExpectedTradingDate}}));}
 return {catalogFingerprint:raw.fingerprint||null,catalog:shares.length,checked,complete,missing,invalid,invalidItems,missingItems,latestExpectedTradingDate,ready:shares.length>0&&checked===shares.length&&complete===shares.length&&missing===0&&invalid===0};
}
let state={version:3,markets:{}};try{state=JSON.parse(await fs.readFile(statePath,'utf8'));}catch{}
const requested=process.env.MARKET_MIC;
let current=requested?plan.markets.find(x=>x.mic===requested):null;
if(!current){const completed=[...plan.markets].reverse().find(x=>x.state==='COMPLETE');current=completed||plan.markets[0];}
if(!current)throw new Error('Geen huidige markt');
const result=await inspect(current);
let next=null;
if(result.ready){
 const planCurrent=plan.markets.find(x=>x.mic===current.mic);
 if(planCurrent){planCurrent.state='COMPLETE';planCurrent.completedAt=new Date().toISOString();planCurrent.catalogFingerprint=result.catalogFingerprint;delete planCurrent.note;}
 await fs.writeFile('data/world-fill-plan.json',JSON.stringify(plan,null,2)+'\n');
 const idx=plan.markets.findIndex(x=>x.mic===current.mic);next=plan.markets.slice(idx+1).find(x=>x.state==='WAITING')||null;
}
const signal={version:2,type:result.ready?(next?'ACTIVATE_NEXT_MARKET':'WORLD_PLAN_COMPLETE'):'KEEP_FILLING_CURRENT_MARKET',emittedAt:new Date().toISOString(),current:{mic:current.mic,code:current.code,name:current.name,...result},next:next?{mic:next.mic,code:next.code,name:next.name}:null,visibleOnPublicSite:false};
state.updatedAt=signal.emittedAt;state.activeMic=next?.mic||current.mic;state.nextMic=next?plan.markets.slice(plan.markets.findIndex(x=>x.mic===next.mic)+1).find(x=>x.state==='WAITING')?.mic||null:null;state.markets||={};state.markets[current.mic]={...(state.markets[current.mic]||{}),state:result.ready?'COMPLETE':'FILLING',...result};if(next)state.markets[next.mic]={...(state.markets[next.mic]||{}),state:'SOURCE_RESEARCH',activatedAt:signal.emittedAt,activatedBy:`handoff:${current.mic}`};
await fs.mkdir('research/output',{recursive:true});await fs.writeFile(signalPath,JSON.stringify(signal,null,2));await fs.writeFile(statePath,JSON.stringify(state,null,2));console.log(JSON.stringify(signal,null,2));if(result.ready&&next)console.log(`KOERSPLEIN_HANDOFF=${next.mic}`);
