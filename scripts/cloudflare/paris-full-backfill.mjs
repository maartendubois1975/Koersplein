import fs from 'node:fs/promises';
import { FactoryApiClient } from './client.mjs';
import { createDefaultProviderRegistry } from '../history/provider-registry.mjs';
import { partitionBars } from './history-format.mjs';
const client=new FactoryApiClient(),registry=createDefaultProviderRegistry();
const raw=JSON.parse(await fs.readFile('data/euronext-paris.json','utf8'));
const instruments=(raw.shares||[]).map(x=>({isin:x.isin,name:x.name,company:x.name,symbol:x.symbol,ticker:x.symbol,mic:'XPAR',market:'XPAR',currency:'EUR',countryCode:'FR',provider:'yahoo-chart'}));
if(instruments.length<700)throw new Error(`Parijse catalogus onverwacht klein: ${instruments.length}`);
const market={mic:'XPAR',code:'paris',name:'Euronext Paris',exchangeGroup:'Euronext',countryCode:'FR',currency:'EUR',timezone:'Europe/Paris'};
await client.seedCatalog({markets:[market],instruments:[]});
const cb=25;for(let o=0;o<instruments.length;o+=cb)await client.seedCatalog({markets:[],instruments:instruments.slice(o,o+cb)});
const today=new Date().toISOString().slice(0,10);let complete=0,unchanged=0,failed=[];
for(let i=0;i<instruments.length;i++){const item=instruments[i];try{let h=null;try{h=await client.history(item.isin)}catch{};if(h?.coverage?.lastDate>=today||h?.coverage?.last_date>=today){unchanged++;continue}const {provider,result}=await registry.fetchDaily(item,{startDate:'1990-01-01',endDate:today},'yahoo-chart');if(!result.bars.length)throw new Error('Geen koershistorie ontvangen');for(const [period,bars] of partitionBars(result.bars))await client.putPartition(item.isin,period,{bars,provider:provider.id});await client.completeHistory(item.isin,{provider:provider.id});complete++;if((i+1)%10===0)console.log(JSON.stringify({stage:'HISTORY',processed:i+1,total:instruments.length,complete,unchanged,failed:failed.length}));}catch(e){failed.push({isin:item.isin,symbol:item.symbol,error:e.message});console.error(JSON.stringify({isin:item.isin,status:'FAILED',error:e.message}))}}
await fs.mkdir('research/output/paris',{recursive:true});await fs.writeFile('research/output/paris/full-backfill-summary.json',JSON.stringify({market:'XPAR',catalog:instruments.length,complete,unchanged,failed},null,2));console.log(JSON.stringify({market:'XPAR',catalog:instruments.length,complete,unchanged,failed:failed.length},null,2));if(failed.length>Math.max(20,instruments.length*.1))process.exitCode=2;
