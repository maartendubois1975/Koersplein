import {mkdir,writeFile} from 'node:fs/promises';
const pages=Array.from({length:12},(_,page)=>`https://live.euronext.com/en/markets/milan/equities/euronext/list?page=${page}`);
const row=/<a[^>]+href="[^"]+"[^>]*>([^<]+)<\/a>[\s\S]{0,1200}?\b([A-Z]{2}[A-Z0-9]{10})\b[\s\S]{0,800}?>([A-Z0-9.]{1,15})</gi;
const byIsin=new Map();let used=[];
for(const url of pages){const r=await fetch(url,{headers:{'user-agent':'Koersplein market catalog/1.0'}});if(!r.ok)continue;const t=await r.text();let n=0;for(const m of t.matchAll(row)){byIsin.set(m[2],{name:m[1].trim(),isin:m[2],symbol:m[3].trim(),market:'Euronext Milan'});n++;}if(n)used.push(url);if(pageDone(t))break;}
function pageDone(t){return !/page=[1-9][0-9]*|Next|next/i.test(t)}
if(byIsin.size<50)throw new Error(`MILAN_CATALOG_INCOMPLETE: parsed ${byIsin.size} regulated-market equities; refusing partial universe`);
const shares=[...byIsin.values()].sort((a,b)=>a.name.localeCompare(b.name,'it'));
await mkdir(new URL('../data',import.meta.url),{recursive:true});
await writeFile(new URL('../data/borsa-italiana-milan.json',import.meta.url),JSON.stringify({exchange:'Euronext Milan',mic:'XMIL',retrievedAt:new Date().toISOString(),source:'Euronext Live Milan regulated equities',sourcePages:used,shares},null,2)+'\n');
console.log(JSON.stringify({count:shares.length,pages:used.length}));
