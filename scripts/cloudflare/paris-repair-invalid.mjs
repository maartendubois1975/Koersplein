import fs from 'node:fs/promises';
import { FactoryApiClient } from './client.mjs';
import { createDefaultProviderRegistry } from '../history/provider-registry.mjs';
import { partitionBars } from './history-format.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const client=new FactoryApiClient(),registry=createDefaultProviderRegistry();
const catalog=JSON.parse(await fs.readFile('data/euronext-paris.json','utf8')).shares||[];
let nonEquitySet=new Set();try{const c=JSON.parse(await fs.readFile('research/output/paris/instrument-classification.json','utf8'));nonEquitySet=new Set((c.nonEquity||[]).map(x=>x.isin))}catch{}
let manifest={instruments:{}};try{manifest=await client.request('/api/history/manifest.json')}catch(e){throw new Error('Historie-manifest niet bereikbaar: '+e.message)}
const targets=catalog.filter(x=>!nonEquitySet.has(x.isin)&&!manifest.instruments?.[x.isin]).map(x=>({isin:x.isin,name:x.name,company:x.name,symbol:x.symbol,ticker:x.symbol,mic:x.mic||'XPAR',market:x.mic||'XPAR',currency:'EUR',countryCode:'FR'}));
const today=new Date().toISOString().slice(0,10);let repaired=[],unavailable=[],failed=[];
for(const item of targets){
 let lastError='';
 for(let attempt=1;attempt<=3;attempt++){
  try{const {provider,result}=await registry.fetchDaily(item,{startDate:'1990-01-01',endDate:today});if(!result.bars.length)throw Error('Geen koershistorie ontvangen');
   for(const [period,bars] of partitionBars(result.bars))await client.putPartition(item.isin,period,{bars,provider:provider.id});
   await client.completeHistory(item.isin,{provider:provider.id});repaired.push({isin:item.isin,symbol:item.symbol,mic:item.mic,provider:provider.id,records:result.bars.length});lastError='';break;
  }catch(e){lastError=e.message;if(attempt<3)await sleep(2000*attempt)}
 }
 if(lastError){const row={isin:item.isin,symbol:item.symbol,mic:item.mic,error:lastError};if(/404|geen koershistorie|historische tabel ontbreekt|providerbeurs wijkt af/i.test(lastError))unavailable.push(row);else failed.push(row)}
 await sleep(300);
}
const report={generatedAt:new Date().toISOString(),selection:'MISSING_FROM_STORED_MANIFEST',targets:targets.length,repaired:repaired.length,unavailable:unavailable.length,failed:failed.length,repairedItems:repaired,unavailableItems:unavailable,failedItems:failed};
await fs.mkdir('research/output/paris',{recursive:true});await fs.writeFile('research/output/paris/repair-invalid-summary.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,repairedItems:undefined,unavailableItems:undefined,failedItems:undefined}));if(failed.length)process.exitCode=2;
