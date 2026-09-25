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
 XETR:{urls:[],discoveryPage:'https://www.cashmarket.deutsche-boerse.com/cash-en/trading/Tradable-Instruments-Xetra/Downloads/xetra-downloads',filePattern:/href=["']([^"']*t7-xetr-allTradableInstruments\.csv[^"']*)["']/i,allowedMics:new Set(['XETR']),market:/Xetra|XETR/i,min:500,format:'xetra'},
 XLIS:{urls:['https://live.euronext.com/en/product_directory/data/stocks-lisbon/download?mics=XLIS%2CALXL%2CENXL'],allowedMics:new Set(['XLIS','ALXL','ENXL']),market:/Lisbon|Growth|Access/i,min:20}
};
const cfg=configs[mic];if(!cfg)throw new Error(`Geen goedgekeurde officiële catalogusadapter voor ${mic}; markt blijft geblokkeerd tot een markt-specifieke adapter bestaat`);
if(cfg.discoveryPage){
 const page=await fetch(cfg.discoveryPage,{headers:{'user-agent':'Koersplein/1.0',accept:'text/html,*/*'}});
 if(!page.ok)throw new Error(`Officiële catalogus-index niet bereikbaar voor ${m.name}: HTTP ${page.status}`);
 const html=await page.text(),match=html.match(cfg.filePattern);
 if(!match)throw new Error(`Officiële cataloguslink niet gevonden op Deutsche Börse downloadpagina voor ${m.name}`);
 const resolved=new URL(match[1].replace(/&amp;/g,'&'),cfg.discoveryPage).href;
 cfg.urls=[resolved];
}
let text='',source='';for(const url of cfg.urls){try{const r=await fetch(url,{headers:{'user-agent':'Koersplein/1.0',accept:'text/csv,text/plain,*/*'}});if(r.ok){const t=(await r.text()).replace(/^\uFEFF/,'');if(t.split(/\r?\n/).length>5){text=t;source=url;break}}}catch{}}
if(!text)throw new Error('Officiële product-directory download niet gevonden voor '+m.name);
if(mic==='XETR'){
 const lines=text.split(/\r?\n/).filter(Boolean), delimiter=';';
 const parse=line=>{const o=[];let cur='',q=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(q&&line[i+1]==='"'){cur+='"';i++}else q=!q}else if(ch===delimiter&&!q){o.push(cur.trim());cur=''}else cur+=ch}o.push(cur.trim());return o};
 const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'');
 const headerIndex=lines.findIndex(line=>{const n=parse(line).map(norm);return n.includes('isin')&&(n.includes('mnemonic')||n.includes('mnemonicinstrument')||n.includes('ticker')||n.includes('symbol'))});
 if(headerIndex<0)throw new Error('XETR officieel CSV-formaat onverwacht: kolomkop met ISIN + mnemonic niet gevonden');
 const header=parse(lines[headerIndex]); const hn=header.map(norm);
 const idx=(...names)=>{for(const n of names){const i=hn.indexOf(norm(n));if(i>=0)return i}return -1};
 const iIsin=idx('ISIN'), iName=idx('Instrument','Instrument Name','Security Description','Long Name'), iSym=idx('Mnemonic','Mnemonic Instrument','Ticker','Symbol'), iType=idx('Product Type','Instrument Type','Security Type'), iMic=idx('MIC','Market Identifier Code');
 if(iIsin<0||iSym<0) throw new Error('XETR officieel CSV-formaat onverwacht: '+JSON.stringify(header));
 const shares=[],seen=new Set(),rejected={missingIdentity:0,nonEquity:0,wrongMic:0,duplicateIsin:0};
 for(const line of lines.slice(headerIndex+1)){const r=parse(line),isin=String(r[iIsin]||'').toUpperCase(),symbol=String(r[iSym]||''),name=String((iName>=0?r[iName]:'')||symbol),type=String(iType>=0?r[iType]:'').toLowerCase(),rowMic=String(iMic>=0?r[iMic]:'XETR').toUpperCase();if(!/^[A-Z]{2}[A-Z0-9]{10}$/.test(isin)||!symbol){rejected.missingIdentity++;continue}if(type&&!/(share|stock|equity|aktie)/i.test(type)){rejected.nonEquity++;continue}if(rowMic&&rowMic!=='XETR'){rejected.wrongMic++;continue}if(seen.has(isin)){rejected.duplicateIsin++;continue}seen.add(isin);shares.push({name,symbol,isin,market:'Xetra',mic:'XETR'});}
 if(shares.length<cfg.min)throw new Error(`Te weinig bewezen ${m.name}-aandelen: ${shares.length}; rejected=${JSON.stringify(rejected)}`);shares.sort((a,b)=>a.name.localeCompare(b.name,'de'));const fingerprint=(await import('node:crypto')).createHash('sha256').update(JSON.stringify(shares.map(x=>[x.isin,x.mic,x.symbol]))).digest('hex');const catalog={exchange:m.name,mic:m.mic,retrievedAt:new Date().toISOString(),source,fingerprint,rawRows:lines.length-headerIndex-1,rejected,shares};await fs.writeFile(`data/euronext-${m.code}.json`,JSON.stringify(catalog,null,2)+'\n');await fs.mkdir('research/output',{recursive:true});await fs.writeFile(`research/output/${m.code}-catalog-gate.json`,JSON.stringify({market:mic,source,fingerprint,rawRows:catalog.rawRows,accepted:shares.length,rejected,pass:true,generatedAt:new Date().toISOString()},null,2));console.log(JSON.stringify({market:mic,rawRows:catalog.rawRows,accepted:shares.length,rejected,fingerprint,source}));process.exit(0);
}
const lines=text.split(/\r?\n/).filter(Boolean),delimiter=[';',',','\t'].sort((a,b)=>lines[0].split(b).length-lines[0].split(a).length)[0];
const parse=line=>{const o=[];let cur='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){cur+='"';i++}else q=!q}else if(c===delimiter&&!q){o.push(cur.trim());cur=''}else cur+=c}o.push(cur.trim());return o};
const h=parse(lines[0]).map(v=>v.toLowerCase().replace(/[^a-z0-9]+/g,'')),pick=(r,a)=>{for(const x of a){const i=h.indexOf(x);if(i>=0&&r[i])return r[i]}return''};
const shares=[],seenIsin=new Set(),seenKey=new Set(),rejected={missingIdentity:0,missingMic:0,wrongMic:0,wrongMarket:0,nonEquity:0,duplicateIsin:0,duplicateMicTicker:0};
for(const line of lines.slice(1)){const r=parse(line),name=pick(r,['name','instrumentname','instrument']),isin=pick(r,['isin','isincode']).toUpperCase(),symbol=pick(r,['symbol','ticker','mnemo']),market=pick(r,['market','markets']),rowMic=pick(r,['mic','miccode','marketmic','segmentmic']).toUpperCase();
 if(!name||!/^[A-Z]{2}[A-Z0-9]{10}$/.test(isin)||!symbol){rejected.missingIdentity++;continue}
 if(mic==='XMIL' && (name.toUpperCase().startsWith('W ') || symbol.toUpperCase().startsWith('W'))){rejected.nonEquity++;continue}
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
