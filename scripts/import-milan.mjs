import {mkdir,writeFile} from 'node:fs/promises';

const candidates=[
 'https://live.euronext.com/en/product_directory/data/stocks-milan/download?mics=MTAA',
 'https://live.euronext.com/en/product_directory/data/stocks-milan/download?mics=XMIL',
 'https://live.euronext.com/en/product_directory/data/stocks-milan/download?mics=MTAA%2CXMIL'
];
const excluded=/WARRANT|\bWARR\b|RIGHTS|SUBSCRIPTION|CERTIFICATE|\bETF\b|\bETN\b|\bBOND\b|OBLIG/i;
function parseRow(line){const a=[];let v='',q=false;for(const c of line){if(c==='"')q=!q;else if(c===';'&&!q){a.push(v);v='';}else v+=c;}a.push(v);return a;}
let selected=null,csv='',evidence=[];
for(const url of candidates){
 const r=await fetch(url,{headers:{'user-agent':'Koersplein market catalog/2.0'}});
 const body=await r.text();
 const lines=body.replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean);
 const hi=lines.findIndex(x=>x.startsWith('Name;'));
 const rows=hi<0?[]:lines.slice(hi+1).map(parseRow).filter(x=>x.length>=4&&x[0]&&x[1]&&x[2]);
 evidence.push({url,status:r.status,rows:rows.length,contentType:r.headers.get('content-type')});
 if(r.ok&&rows.length>=50){selected=url;csv=body;break;}
}
if(!selected)throw new Error('MILAN_DOWNLOAD_NOT_RESOLVED: '+JSON.stringify(evidence));
const lines=csv.replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean);
const hi=lines.findIndex(x=>x.startsWith('Name;'));
const byIsin=new Map();
for(const row of lines.slice(hi+1).map(parseRow)){
 if(row.length<4||!row[0]||!row[1]||!row[2]||excluded.test(row[0]))continue;
 const [name,isin,symbol,market]=row;
 if(!/^[A-Z]{2}[A-Z0-9]{10}$/.test(isin))continue;
 byIsin.set(isin,{name,isin,symbol,market});
}
if(byIsin.size<50)throw new Error('MILAN_CATALOG_INCOMPLETE: '+byIsin.size);
const shares=[...byIsin.values()].sort((a,b)=>a.name.localeCompare(b.name,'it'));
await mkdir(new URL('../data',import.meta.url),{recursive:true});
await writeFile(new URL('../data/borsa-italiana-milan.json',import.meta.url),JSON.stringify({exchange:'Euronext Milan',mic:'XMIL',retrievedAt:new Date().toISOString(),source:selected,evidence,shares},null,2)+'\n');
console.log(JSON.stringify({count:shares.length,source:selected}));
