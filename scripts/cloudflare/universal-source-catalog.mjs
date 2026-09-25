import fs from 'node:fs/promises';
const mic=process.env.MARKET_MIC;if(!mic)throw new Error('MARKET_MIC vereist');
const plan=JSON.parse(await fs.readFile('data/world-fill-plan.json','utf8')),m=plan.markets.find(x=>x.mic===mic);if(!m)throw new Error('Onbekende markt '+mic);
const configs={
 XMIL:{urls:['https://live.euronext.com/en/product_directory/data/stocks-milan/download?mics=XMIL%2CMTAA%2CEXGM','https://live.euronext.com/en/product_directory/data/stocks-milan/download?mics=MTAA%2CEXGM'],allowedMics:new Set(['XMIL','MTAA','EXGM']),market:/Milan|Growth|Borsa Italiana/i,min:200,locale:'it'},
 XOSL:{urls:['https://live.euronext.com/en/product_directory/data/stocks-oslo/download?mics=XOSL%2CMERK%2CXOAS'],allowedMics:new Set(['XOSL','MERK','XOAS']),market:/Oslo|Growth|Expand/i,min:150,locale:'nb'},
 XAMS:{urls:['https://live.euronext.com/en/product_directory/data/stocks-amsterdam/download?mics=XAMS'],allowedMics:new Set(['XAMS']),market:/Amsterdam/i,min:20},
 XBRU:{urls:['https://live.euronext.com/en/product_directory/data/stocks-brussels/download?mics=XBRU'],allowedMics:new Set(['XBRU']),market:/Brussels|Brussel/i,min:20},
 XPAR:{urls:['https://live.euronext.com/en/product_directory/data/stocks-paris/download?mics=XPAR%2CALXP%2CXMLI'],allowedMics:new Set(['XPAR','ALXP','XMLI']),market:/Paris|Growth|Access/i,min:50},
 XDUB:{urls:['https://live.euronext.com/en/product_directory/data/stocks-dublin/download?mics=XDUB%2CXESM'],allowedMics:new Set(['XDUB','XESM']),market:/Dublin|Irish|Growth/i,min:20},
 XLIS:{urls:['https://live.euronext.com/en/product_directory/data/stocks-lisbon/download?mics=XLIS%2CALXL%2CENXL'],allowedMics:new Set(['XLIS','ALXL','ENXL']),market:/Lisbon|Growth|Access/i,min:20}
};
const cfg=configs[mic];if(!cfg)throw new Error(`Geen goedgekeurde officiële catalogusadapter voor ${mic}; markt blijft geblokkeerd tot een markt-specifieke adapter bestaat`);
let text='',source='';for(const url of cfg.urls){try{const r=await fetch(url,{headers:{'user-agent':'Koersplein/1.0',accept:'text/csv,text/plain,*/*'}});if(r.ok){const t=(await r.text()).replace(/^\uFEFF/,'');if(t.split(/\r?\n/).length>5){text=t;source=url;break}}}catch{}}
if(!text)throw new Error('Officiële product-directory download niet gevonden voor '+m.name);
const lines=text.split(/\r?\n/).filter(Boolean),delimiter=[';',',','\t'].sort((a,b)=>lines[0].split(b).length-lines[0].split(a).length)[0];
const parse=line=>{const o=[];let cur='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){cur+='"';i++}else q=!q}else if(c===delimiter&&!q){o.push(cur.trim());cur=''}else cur+=c}o.push(cur.trim());return o};
const h=parse(lines[0]).map(v=>v.toLowerCase().replace(/[^a-z0-9]+/g,'')),pick=(r,a)=>{for(const x of a){const i=h.indexOf(x);if(i>=0&&r[i])return r[i]}return''};
const shares=[],seenIsin=new Set(),seenKey=new Set(),rejected={missingIdentity:0,missingMic:0,wrongMic:0,wrongMarket:0,nonEquity:0,duplicateIsin:0,duplicateMicTicker:0};
for(const line of lines.slice(1)){const r=parse(line),name=pick(r,['name','instrumentname','instrument']),isin=pick(r,['isin','isincode']).toUpperCase(),symbol=pick(r,['symbol','ticker','mnemo']),market=pick(r,['market','markets']),rowMic=pick(r,['mic','miccode','marketmic','segmentmic']).toUpperCase();
 if(!name||!/^[A-Z]{2}[A-Z0-9]{10}$/.test(isin)||!symbol){rejected.missingIdentity++;continue}\n if(mic==='XMIL' && (name.toUpperCase().startsWith('W ') || symbol.toUpperCase().startsWith('W'))){rejected.nonEquity++;continue}
 let provenMic=rowMic;
 if(!provenMic&&mic==='XDUB'){
   if(/Growth|ESM/i.test(market))provenMic='XESM';
   else if(/Dublin|Irish/i.test(market))provenMic='XDUB';
 }
 if(!provenMic&&mic==='XLIS'){
   if(/Growth/i.test(market))provenMic='ALXL';
   else if(/Access/i.test(market))provenMic='ENXL';
   else if(/Lisbon/i.test(market))provenMic='XLIS';
 }
 if(!provenMic&&mic==='XMIL'){
   // Euronext Milan's official CSV currently leaves the MIC column empty.
   // Infer only from the official market/segment label, never from the requested market.
   if(/Euronext Growth Milan|Growth Milan|EGM/i.test(market))provenMic='EXGM';
   else if(/Euronext Milan|Borsa Italiana|MTA|Mercato Telematico Azionario/i.test(market))provenMic='MTAA';
 }
 if(!provenMic){rejected.missingMic++;continue}
 if(!cfg.allowedMics.has(provenMic)){rejected.wrongMic++;continue}
 if(market&&!cfg.market.test(market)){rejected.wrongMarket++;continue}
 const key=provenMic+'\u0000'+symbol.toUpperCase();if(seenIsin.has(isin)){rejected.duplicateIsin++;continue}if(seenKey.has(key)){rejected.duplicateMicTicker++;continue}
 seenIsin.add(isin);seenKey.add(key);shares.push({name,symbol,isin,market:market||m.name,mic:provenMic});
}
if(shares.length<cfg.min)throw new Error(`Te weinig bewezen ${m.name}-aandelen: ${shares.length}; rejected=${JSON.stringify(rejected)}`);
shares.sort((a,b)=>a.name.localeCompare(b.name,cfg.locale));
const fingerprint=(await import('node:crypto')).createHash('sha256').update(JSON.stringify(shares.map(x=>[x.isin,x.mic,x.symbol]))).digest('hex');
const catalog={exchange:m.name,mic:m.mic,retrievedAt:new Date().toISOString(),source,fingerprint,rawRows:lines.length-1,rejected,shares};
await fs.writeFile(`data/euronext-${m.code}.json`,JSON.stringify(catalog,null,2)+'\n');await fs.mkdir('research/output',{recursive:true});await fs.writeFile(`research/output/${m.code}-catalog-gate.json`,JSON.stringify({market:mic,source,fingerprint,rawRows:catalog.rawRows,accepted:shares.length,rejected,pass:true,generatedAt:new Date().toISOString()},null,2));
console.log(JSON.stringify({market:mic,rawRows:catalog.rawRows,accepted:shares.length,rejected,fingerprint,source}));
