import fs from 'node:fs/promises';
import {reconcile} from './reconcile-isin.mjs';
const url='https://athens.euronext.com/en/trade/trading-products/trading-issuers';
const pages=await Promise.all('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(async letter=>{const res=await fetch(url+'?letter='+letter,{headers:{'User-Agent':'Mozilla/5.0'}});if(!res.ok)throw Error('Issuer listing HTTP '+res.status+' '+letter);return res.text()}));
const html=pages.join('\n');
const catalog=JSON.parse(await fs.readFile(new URL('../../data/euronext-athens.json',import.meta.url)));
const symbols=new Set(catalog.shares.map(s=>s.symbol));
const date=new Date().toISOString().slice(0,10);
const strip=s=>s.replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/\s+/g,' ').trim();
const evidence=[];
for(const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
 const cells=[...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m=>strip(m[1]));
 const isin=cells.find(v=>/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(v));
 const symbol=cells.find(v=>symbols.has(v));
 if(isin&&symbol&&cells.some(v=>v==='Stock'))evidence.push({symbol,isin,sourceUrl:url,sourceDate:date,sourceDocument:'Euronext Athens Trading Issuers'});
}
const report=reconcile(catalog,evidence);
await fs.mkdir('research/output/audit',{recursive:true});
await fs.writeFile('research/output/audit/athens-public-evidence.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({pages:pages.length,bytes:html.length,parsed:evidence.length,accepted:report.accepted.length,rejected:report.rejected.length,remaining:report.unresolved,examples:evidence.slice(0,2)}));
if(!report.accepted.length)throw Error('No matched public issuer table rows');
