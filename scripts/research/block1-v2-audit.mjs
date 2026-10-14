import fs from 'node:fs/promises';
import {normalizeCatalog} from './block1-v2-core.mjs';
const plan=JSON.parse(await fs.readFile('data/world-fill-plan.json','utf8'));
if(plan.markets.length!==31)throw Error('Expected exactly 31 markets');
const markets=[],allSecurities=new Map();
for(const market of plan.markets){
 const raw=JSON.parse(await fs.readFile('data/euronext-'+market.code+'.json','utf8'));
 const items=Array.isArray(raw)?raw:(raw.shares||raw.instruments||[]);
 const normalized=normalizeCatalog(market,items);
 for(const s of normalized.securities){
  const old=allSecurities.get(s.isin);
  if(old&&old.type!==s.type)normalized.rejected.push({isin:s.isin,issues:['CROSS_MARKET_TYPE_CONFLICT']});
  else allSecurities.set(s.isin,s);
 }
 markets.push({mic:market.mic,code:market.code,...normalized.summary,rejected:normalized.rejected});
}
const totals={markets:markets.length,input:markets.reduce((a,m)=>a+m.input,0),acceptedListings:markets.reduce((a,m)=>a+m.acceptedListings,0),rejected:markets.reduce((a,m)=>a+m.rejected.length,0),distinctSecurities:allSecurities.size};
const report={schema:'block1-v2-audit/1',generatedAt:new Date().toISOString(),status:totals.rejected?'NOT_READY':'STRUCTURE_VERIFIED_SOURCE_RECONCILIATION_PENDING',totals,markets};
await fs.mkdir('research/output/machine-arena',{recursive:true});
await fs.writeFile('research/output/machine-arena/block1-v2-audit.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({status:report.status,totals}));
if(totals.rejected)process.exitCode=1;
