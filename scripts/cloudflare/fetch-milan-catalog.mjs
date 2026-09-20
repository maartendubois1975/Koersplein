import { writeFile } from 'node:fs/promises';
const urls=[
 'https://live.euronext.com/en/product_directory/data/stocks-milan/download?mics=MTAA%2CEXGM',
 'https://live.euronext.com/en/product_directory/data/stocks-milan/download?mics=XMIL%2CMTAA%2CEXGM'
];
let text='',source='';
for(const url of urls){try{const r=await fetch(url,{headers:{'user-agent':'Koersplein/1.0',accept:'text/csv,text/plain,*/*'}});if(r.ok){const t=(await r.text()).replace(/^\uFEFF/,'');if(t.split(/\r?\n/).length>20){text=t;source=url;break}}}catch{}}
if(!text)throw new Error('Officiële Milaan product-directory download niet gevonden');
const lines=text.split(/\r?\n/).filter(Boolean),delimiter=[';',',','\t'].sort((a,b)=>lines[0].split(b).length-lines[0].split(a).length)[0];
const parse=line=>{const o=[];let cur='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){cur+='"';i++}else q=!q}else if(c===delimiter&&!q){o.push(cur.trim());cur=''}else cur+=c}o.push(cur.trim());return o};
const h=parse(lines[0]).map(v=>v.toLowerCase().replace(/[^a-z0-9]+/g,'')),pick=(r,a)=>{for(const x of a){const i=h.indexOf(x);if(i>=0&&r[i])return r[i]}return''};
const shares=[];
for(const line of lines.slice(1)){const r=parse(line),name=pick(r,['name','instrumentname','instrument']),isin=pick(r,['isin','isincode']),symbol=pick(r,['symbol','ticker','mnemo']),market=pick(r,['market','markets']),mic=pick(r,['mic','miccode','marketmic','segmentmic']);if(!name||!/^[A-Z]{2}[A-Z0-9]{10}$/.test(isin)||!symbol)continue;if(!/Milan|Growth/i.test(market||''))continue;const m=(mic||(/Growth/i.test(market)?'EXGM':'MTAA')).toUpperCase();if(!shares.some(x=>x.isin===isin))shares.push({name,symbol,isin,market:market||'Euronext Milan',mic:m})}
if(shares.length<200)throw new Error('Te weinig Milanese aandelen herkend: '+shares.length);
shares.sort((a,b)=>a.name.localeCompare(b.name,'it'));await writeFile(new URL('../../data/euronext-milan.json',import.meta.url),JSON.stringify({exchange:'Borsa Italiana / Euronext Milan',mic:'XMIL',retrievedAt:new Date().toISOString(),source,shares},null,2)+'\n');console.log(JSON.stringify({market:'XMIL',shares:shares.length,source},null,2));