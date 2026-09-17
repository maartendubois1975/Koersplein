import { mkdir, writeFile } from 'node:fs/promises';
import { FactoryApiClient } from '../cloudflare/client.mjs';
import { cloudflareCatalog } from '../cloudflare/catalog.mjs';
import { scanPlus30Chain, summarizePlus30Chains } from './plus30-chain-scanner.mjs';
const client=new FactoryApiClient(); const catalog=await cloudflareCatalog();
const rows=[]; const failures=[];
for(const x of catalog.instruments.filter(x=>x.mic==='XAMS')){
 try{
  const h=await client.history(x.isin); const bars=h.bars||h.history||h.records||h.data||[];
  const r=scanPlus30Chain(bars); rows.push({isin:x.isin,ticker:x.ticker,company:x.company,...r});
 }catch(e){failures.push({isin:x.isin,ticker:x.ticker,error:e.message})}
}
const summary=summarizePlus30Chains(rows);
const quick=rows.flatMap(r=>(r.hits||[]).filter(h=>h.within90Days).map(h=>({ticker:r.ticker,company:r.company,...h})));
const counts={}; for(const h of quick) counts[h.ticker]=(counts[h.ticker]||0)+1;
summary.instruments=rows.length; summary.failures=failures; summary.topStocks=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,20).map(([ticker,count])=>({ticker,count})); summary.fastest=quick.sort((a,b)=>a.calendarDays-b.calendarDays).slice(0,20);
await mkdir('research/output/plus30-chain',{recursive:true}); await writeFile('research/output/plus30-chain/summary.json',JSON.stringify(summary,null,2)); await writeFile('research/output/plus30-chain/results.json',JSON.stringify(rows)); console.log(JSON.stringify(summary,null,2));
if(failures.length) process.exitCode=2;
