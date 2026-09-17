import fs from 'node:fs/promises';
import { FactoryApiClient } from './client.mjs';
import { createDefaultProviderRegistry } from '../history/provider-registry.mjs';
import { partitionBars } from './history-format.mjs';
const client=new FactoryApiClient();const registry=createDefaultProviderRegistry();
const plan=JSON.parse(await fs.readFile('data/world-fill-plan.json','utf8'));const mic=process.env.MARKET_MIC||'XPAR';const m=plan.markets.find(x=>x.mic===mic);if(!m)throw new Error(`MARKET_MIC ${mic} niet in actief plan`);
const path=`data/euronext-${m.code}.json`;const raw=JSON.parse(await fs.readFile(path,'utf8'));const source=raw.shares||raw.instruments||[];if(!source.length)throw new Error('lege catalogus');
const instruments=source.map(x=>({isin:x.isin,name:x.name||x.company,company:x.name||x.company,symbol:x.symbol||x.ticker,ticker:x.symbol||x.ticker,mic:m.mic,market:m.mic,currency:m.currency,countryCode:m.country,provider:'yahoo-chart'}));
await client.seedCatalog({markets:[{mic:m.mic,code:m.code,name:m.name,exchangeGroup:'world',countryCode:m.country,currency:m.currency,timezone:m.timezone}],instruments:[]});
const cb=Number(process.env.CATALOG_BATCH_SIZE||25);for(let i=0;i<instruments.length;i+=cb)await client.seedCatalog({markets:[],instruments:instruments.slice(i,i+cb)});
const hb=Number(process.env.HISTORY_BATCH_SIZE||10),offset=Number(process.env.HISTORY_OFFSET||0),today=new Date().toISOString().slice(0,10);let complete=0,failed=[];
for(const item of instruments.slice(offset,offset+hb)){try{let existing=null;try{existing=await client.history(item.isin)}catch{};if(existing?.coverage?.lastDate>=today){complete++;continue}const {provider,result}=await registry.fetchDaily(item,{startDate:'1990-01-01',endDate:today},'yahoo-chart');if(!result.bars.length)throw new Error('geen historie');for(const [period,bars] of partitionBars(result.bars))await client.putPartition(item.isin,period,{bars,provider:provider.id});await client.completeHistory(item.isin,{provider:provider.id});complete++;}catch(e){failed.push({isin:item.isin,error:e.message})}}
console.log(JSON.stringify({market:mic,catalog:instruments.length,offset,batch:hb,complete,failed},null,2));if(failed.length)process.exitCode=2;
