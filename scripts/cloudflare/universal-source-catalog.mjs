import fs from 'node:fs/promises';
const mic=process.env.MARKET_MIC;if(!mic)throw new Error('MARKET_MIC vereist');
const plan=JSON.parse(await fs.readFile('data/world-fill-plan.json','utf8')),m=plan.markets.find(x=>x.mic===mic);if(!m)throw new Error('Onbekende markt '+mic);
const slug=m.code;
const urls=[`https://live.euronext.com/en/product_directory/data/stocks-${slug}/download`,`https://live.euronext.com/en/product_directory/data/stocks-${slug}/download?mics=${encodeURIComponent(mic)}`];
let text='',source='';for(const url of urls){try{const r=await fetch(url,{headers:{'user-agent':'Koersplein/1.0',accept:'text/csv,text/plain,*/*'}});if(r.ok){const t=(await r.text()).replace(/^\uFEFF/,'');if(t.split(/\r?\n/).length>5){text=t;source=url;break}}}catch{}}
if(!text)throw new Error('Officiële product-directory download niet gevonden voor '+m.name);
const lines=text.split(/\r?\n/).filter(Boolean),delimiter=[';',',','\t'].sort((a,b)=>lines[0].split(b).length-lines[0].split(a).length)[0];
const parse=line=>{const o=[];let cur='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){cur+='"';i++}else q=!q}else if(c===delimiter&&!q){o.push(cur.trim());cur=''}else cur+=c}o.push(cur.trim());return o};
const h=parse(lines[0]).map(v=>v.toLowerCase().replace(/[^a-z0-9]+/g,'')),pick=(r,a)=>{for(const x of a){const i=h.indexOf(x);if(i>=0&&r[i])return r[i]}return''};
const shares=[];for(const line of lines.slice(1)){const r=parse(line),name=pick(r,['name','instrumentname','instrument']),isin=pick(r,['isin','isincode']),symbol=pick(r,['symbol','ticker','mnemo']),market=pick(r,['market','markets']),rawMic=pick(r,['mic','miccode','marketmic','segmentmic']);if(!name||!/^[A-Z]{2}[A-Z0-9]{10}$/.test(isin)||!symbol)continue;const rowMic=String(rawMic||mic).toUpperCase();if(!shares.some(x=>x.isin===isin))shares.push({name,symbol,isin,market:market||m.name,mic:rowMic})}
if(shares.length<5)throw new Error('Te weinig aandelen herkend voor '+m.name+': '+shares.length);
shares.sort((a,b)=>a.name.localeCompare(b.name));await fs.writeFile(`data/euronext-${m.code}.json`,JSON.stringify({exchange:m.name,mic:m.mic,retrievedAt:new Date().toISOString(),source,shares},null,2)+'\n');console.log(JSON.stringify({market:mic,shares:shares.length,source}));
