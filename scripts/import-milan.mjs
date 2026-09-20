import {mkdir,writeFile} from 'node:fs/promises';

const sources=[
  {url:'https://live.euronext.com/en/pd_es/stocks/MTAA/dp_stocks/df_stocks3/dt_stocks_milreg',market:'Euronext Milan'},
  {url:'https://live.euronext.com/en/markets/milan/equities/euronext/list',market:'Euronext Milan'},
  {url:'https://live.euronext.com/en/markets/milan/equities/star/list',market:'Euronext Milan'}
];
const isinRe=/\b[A-Z]{2}[A-Z0-9]{10}\b/g;
const byIsin=new Map();
const evidence=[];
for(const source of sources){
  const r=await fetch(source.url,{headers:{'user-agent':'Koersplein market catalog/1.1','accept-language':'en'}});
  if(!r.ok){evidence.push({url:source.url,status:r.status,found:0});continue}
  const html=await r.text();
  const isins=[...new Set(html.match(isinRe)||[])];
  evidence.push({url:source.url,status:r.status,found:isins.length});
  for(const isin of isins){
    if(!byIsin.has(isin))byIsin.set(isin,{name:null,symbol:null,isin,market:source.market});
  }
}
if(byIsin.size<50)throw new Error(`MILAN_CATALOG_INCOMPLETE: official Euronext sources yielded ${byIsin.size} unique ISINs; evidence=${JSON.stringify(evidence)}`);
const shares=[...byIsin.values()].sort((a,b)=>a.isin.localeCompare(b.isin));
await mkdir(new URL('../data',import.meta.url),{recursive:true});
await writeFile(new URL('../data/borsa-italiana-milan.json',import.meta.url),JSON.stringify({exchange:'Euronext Milan',mic:'XMIL',retrievedAt:new Date().toISOString(),sources:evidence,shares},null,2)+'\n');
console.log(JSON.stringify({count:shares.length,sources:evidence}));
