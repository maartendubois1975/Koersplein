import fs from 'node:fs/promises';
import {loadCompanyCatalog} from '../history/company-register.mjs';
import {createDefaultProviderRegistry} from '../history/provider-registry.mjs';
import {fetchConfiguredHistory} from '../history/source-policy.mjs';
import {validateBars} from '../history/bars.mjs';
const plan=JSON.parse(await fs.readFile('research/output/paris-storage-plan.json','utf8'));
const catalog=await loadCompanyCatalog('XPAR');
const byId=new Map(catalog.shares.map(s=>[s.isin,s]));
const registry=createDefaultProviderRegistry();
const endDate='2026-11-13',startDate='2024-11-14';
const results=[];
async function probe(row){
 const share=byId.get(row.isin);
 if(!share||share.mic!==row.mic)throw Error('Unapproved identity');
 try{
  const {provider,result}=await fetchConfiguredHistory(registry,{...share,currency:'EUR'},{startDate,endDate},{timeoutMs:45000});
  const bars=validateBars(result.bars).filter(b=>b.volume>0);
  if(!bars.length)throw Error('No confirmed traded OHLC');
  return {...row,classification:'SOURCE_BARS_AVAILABLE',provider:provider.id,requestUrl:result.requestUrl,firstDate:bars[0].date,lastDate:bars.at(-1).date,bars};
 }catch(e){return {...row,classification:'SOURCE_UNRESOLVED',error:e.message};}
}
const targets=plan.rows.filter(r=>r.action!=='AUDIT_EXISTING');
for(let i=0;i<targets.length;i+=3){
 results.push(...await Promise.all(targets.slice(i,i+3).map(probe)));
}
const counts={};for(const r of results)counts[r.classification]=(counts[r.classification]||0)+1;
await fs.writeFile('research/output/paris-recovery-evidence.json',JSON.stringify({readOnly:true,startDate,endDate,counts,results},null,2)+'\n');
console.log('PARIS_RECOVERY_RESULTS '+JSON.stringify(counts));
console.log('PARIS_RECOVERY_DETAIL '+JSON.stringify(results.map(({bars,...r})=>({...r,barCount:bars?.length||0}))));
