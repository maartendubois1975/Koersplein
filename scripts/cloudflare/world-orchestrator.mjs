import fs from 'node:fs/promises';
import { FactoryApiClient } from './client.mjs';

const client=new FactoryApiClient();
const plan=JSON.parse(await fs.readFile('data/world-fill-plan.json','utf8'));
const statePath='research/output/world-fill-state.json';
let state={version:1,updatedAt:null,markets:{}};
try{state=JSON.parse(await fs.readFile(statePath,'utf8'));}catch{}
const active=plan.markets.find(m=>!['COMPLETE'].includes(state.markets[m.mic]?.state||m.state));
if(!active){console.log(JSON.stringify({status:'WORLD_PLAN_COMPLETE'}));process.exit(0);}
const entry=state.markets[active.mic]||{state:'WAITING',attempts:0};
entry.attempts=(entry.attempts||0)+1;
entry.lastRunAt=new Date().toISOString();
try{
  const catalog=JSON.parse(await fs.readFile(`data/euronext-${active.code}.json`,'utf8'));
  const shares=catalog.shares||catalog.instruments||[];
  if(!shares.length) throw new Error(`Catalogus ontbreekt/leeg voor ${active.code}`);
  let complete=0,missing=0,invalid=0;
  for(const s of shares){
    const isin=s.isin;
    try{const h=await client.history(isin);const bars=Array.isArray(h?.bars)?h.bars:Array.isArray(h?.history)?h.history:Array.isArray(h?.data)?h.data:[];if(bars.length)complete++;else missing++;}
    catch{missing++;}
  }
  entry.catalogCount=shares.length;entry.historyComplete=complete;entry.missing=missing;entry.invalid=invalid;
  entry.state=(missing===0&&invalid===0)?'READY_FOR_VALIDATION':'FILLING';
  entry.nextAction=entry.state==='READY_FOR_VALIDATION'?'VALIDATE_HISTORY':'CONTINUE_HISTORY_BACKFILL';
}catch(error){entry.state='BLOCKED';entry.error=error.message;entry.nextAction='REPAIR_OR_ADD_CATALOG';}
state.markets[active.mic]=entry;state.updatedAt=new Date().toISOString();
await fs.mkdir('research/output',{recursive:true});await fs.writeFile(statePath,JSON.stringify(state,null,2));
console.log(JSON.stringify({activeMarket:active,state:entry},null,2));
