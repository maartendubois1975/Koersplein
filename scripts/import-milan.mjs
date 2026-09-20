import {mkdir,writeFile} from 'node:fs/promises';
const endpoints=[
  process.env.KOERSPLEIN_MILAN_CATALOG_URL,
  'https://www.borsaitaliana.it/borsa/azioni/tutti-gli-strumenti.html'
].filter(Boolean);
const isin=/\bIT[0-9A-Z]{10}\b/g;
const symbol=/data-symbol=["']([^"']+)["']/gi;
let source=null,text='';
for(const url of endpoints){try{const r=await fetch(url,{headers:{'user-agent':'Koersplein research catalog/1.0'}});if(r.ok){const t=await r.text();if((t.match(isin)||[]).length){source=url;text=t;break}}}catch{}}
if(!source)throw new Error('MILAN_CATALOG_SOURCE_NOT_RESOLVED: official/public catalog yielded no ISIN universe');
const isins=[...new Set(text.match(isin)||[])];
const symbols=[...text.matchAll(symbol)].map(x=>x[1]);
const shares=isins.map((isin,i)=>({name:null,symbol:symbols[i]||null,isin,market:'Borsa Italiana Milan'}));
await mkdir(new URL('../data',import.meta.url),{recursive:true});
await writeFile(new URL('../data/borsa-italiana-milan.json',import.meta.url),JSON.stringify({exchange:'Borsa Italiana Milan',mic:'XMIL',retrievedAt:new Date().toISOString(),source,shares},null,2)+'\n');
console.log(JSON.stringify({source,count:shares.length}));
