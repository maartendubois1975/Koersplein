import { writeFile } from 'node:fs/promises';
const urls=[
 'https://live.euronext.com/en/product_directory/data/stocks-oslo/download?mics=XOSL%2CMERK%2CXOAS',
 'https://live.euronext.com/en/product_directory/data/stocks-oslo/download?mics=XOSL%2CXOAS%2CMERK'
];
let text='',source='';
for(const url of urls){try{const r=await fetch(url,{headers:{'user-agent':'Koersplein/1.0',accept:'text/csv,text/plain,*/*'}});if(r.ok){const t=(await r.text()).replace(/^\uFEFF/,'');if(t.split(/\r?\n/).length>20){text=t;source=url;break}}}catch{}}
if(!text)throw new Error('Officiële Oslo product-directory download niet gevonden');
const lines=text.split(/\r?\n/).filter(Boolean),delimiter=[';',',','\t'].sort((a,b)=>lines[0].split(b).length-lines[0].split(a).length)[0];
const parse=line=>{const o=[];let cur='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){cur+='"';i++}else q=!q}else if(c===delimiter&&!q){o.push(cur.trim());cur=''}else cur+=c}o.push(cur.trim());return o};
const h=parse(lines[0]).map(v=>v.toLowerCase().replace(/[^a-z0-9]+/g,'')),pick=(r,a)=>{for(const x of a){const i=h.indexOf(x);if(i>=0&&r[i])return r[i]}return''};
const shares=[];
for(const line of lines.slice(1)){const r=parse(line),name=pick(r,['name','instrumentname','instrument']),isin=pick(r,['isin','isincode']),symbol=pick(r,['symbol','ticker','mnemo']),market=pick(r,['market','markets']),rawMic=pick(r,['mic','miccode','marketmic','segmentmic']);if(!name||!/^[A-Z]{2}[A-Z0-9]{10}$/.test(isin)||!symbol)continue;if(!/Oslo|Growth|Expand/i.test(market||''))continue;let mic=String(rawMic||'').toUpperCase();if(!['XOSL','MERK','XOAS'].includes(mic))mic=/Growth/i.test(market)?'MERK':/Expand/i.test(market)?'XOAS':'XOSL';if(!shares.some(x=>x.isin===isin))shares.push({name,symbol,isin,market:market||'Oslo Børs',mic})}
if(shares.length<150)throw new Error('Te weinig Oslo-aandelen herkend: '+shares.length);
const segments=Object.fromEntries(['XOSL','MERK','XOAS'].map(m=>[m,shares.filter(x=>x.mic===m).length]));if(!segments.XOSL||!segments.MERK||!segments.XOAS)throw new Error('Oslo-catalogus mist marktsegment: '+JSON.stringify(segments));
shares.sort((a,b)=>a.name.localeCompare(b.name,'nb'));await writeFile(new URL('../../data/euronext-oslo.json',import.meta.url),JSON.stringify({exchange:'Euronext Oslo Børs',mic:'XOSL',retrievedAt:new Date().toISOString(),source,segments,shares},null,2)+'\n');console.log(JSON.stringify({market:'XOSL',shares:shares.length,segments,source},null,2));