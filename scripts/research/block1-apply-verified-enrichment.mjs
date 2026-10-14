import fs from 'node:fs/promises';
import {isValidIsin} from './isin-identity-core.mjs';

// Only apply externally documented, manually reviewed evidence.
// Never overwrite source catalogues or infer a type/ISIN from a ticker.
const input=process.argv[2];
if(!input)throw Error('Usage: node block1-apply-verified-enrichment.mjs <reviewed-evidence.json>');
const evidence=JSON.parse(await fs.readFile(input,'utf8'));
if(!Array.isArray(evidence.records))throw Error('Evidence must contain records array');
const plan=JSON.parse(await fs.readFile('data/world-fill-plan.json','utf8'));
const markets=new Map(plan.markets.map(m=>[m.mic,m]));
const updates=new Map(),errors=[];
for(const [i,r] of evidence.records.entries()){
 const id=i+1,market=markets.get(r.mic);
 if(!market){errors.push({row:id,error:'UNKNOWN_MIC'});continue;}
 if(!r.symbol||!r.isin||!isValidIsin(r.isin)||!r.securityType||!r.sourceUrl||!/^https:\/\//.test(r.sourceUrl)||!r.verifiedAt||!/^\d{4}-\d{2}-\d{2}$/.test(r.verifiedAt)){
  errors.push({row:id,error:'INCOMPLETE_OR_INVALID_EVIDENCE'});continue;
 }
 const key=r.mic+'|'+r.symbol;
 if(updates.has(key)){errors.push({row:id,error:'DUPLICATE_EVIDENCE'});continue;}
 updates.set(key,r);
}
if(errors.length)throw Error(JSON.stringify(errors));
const changes=[],notFound=[],staged=[];
for(const market of plan.markets){
 const raw=JSON.parse(await fs.readFile('data/euronext-'+market.code+'.json','utf8'));
 const items=Array.isArray(raw)?raw:(raw.shares||raw.instruments||[]);
 const bySymbol=new Map();
 const ambiguous=new Set();
 for(const [index,item] of items.entries()){
  const symbol=String(item.providerSymbol||item.symbol||item.ticker||'');
  if(bySymbol.has(symbol))ambiguous.add(symbol);
  else bySymbol.set(symbol,index);
 }
 const updated=items.map(item=>({...item}));
 for(const [key,r] of updates){
  if(r.mic!==market.mic)continue;
  const index=bySymbol.get(r.symbol);
  if(index===undefined){notFound.push(key);continue;}
  if(ambiguous.has(r.symbol)){errors.push({key,error:'AMBIGUOUS_SYMBOL'});continue;}
  const old=updated[index];
  if(old.isin&&isValidIsin(old.isin)&&old.isin!==r.isin){errors.push({key,error:'ISIN_CONFLICT',existing:old.isin,proposed:r.isin});continue;}
  updated[index]={...old,isin:r.isin,securityType:r.securityType,securityTypeSource:r.sourceName||'Official listing evidence',securityTypeSourceUrl:r.sourceUrl,securityTypeVerifiedAt:r.verifiedAt};
  changes.push({mic:r.mic,symbol:r.symbol,isin:r.isin,type:r.securityType,sourceUrl:r.sourceUrl});
 }
 const output='research/output/block1-enriched/euronext-'+market.code+'.json';
 staged.push({output,content:JSON.stringify(Array.isArray(raw)?updated:{...raw,[Array.isArray(raw.shares)?'shares':'instruments']:updated},null,2)});
}
if(notFound.length||errors.length)throw Error(JSON.stringify({notFound,errors}));
await fs.mkdir('research/output/block1-enriched',{recursive:true});
for(const item of staged)await fs.writeFile(item.output,item.content);
await fs.writeFile('research/output/block1-enriched/manifest.json',JSON.stringify({generatedAt:new Date().toISOString(),status:'REVIEW_REQUIRED_NOT_PRODUCTION',changes},null,2));
console.log(JSON.stringify({status:'REVIEW_REQUIRED_NOT_PRODUCTION',changes:changes.length,output:'research/output/block1-enriched'}));
