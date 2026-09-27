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
 XETR:{urls:['https://www.cashmarket.deutsche-boerse.com/resource/blob/1528/b52ea43a2edac92e8283d40645d1c076/data/t7-xetr-allTradableInstruments.csv'],allowedMics:new Set(['XETR']),market:/Xetra|XETR/i,min:500,format:'xetra'},
 XLIS:{urls:['https://live.euronext.com/en/product_directory/data/stocks-lisbon/download?mics=XLIS%2CALXL%2CENXL'],allowedMics:new Set(['XLIS','ALXL','ENXL']),market:/Lisbon|Growth|Access/i,min:20},
 XSWX:{urls:['https://www.six-group.com/dam/download/market-data/statistics/monthly-report/mtd/2026/monthly-trade-data-202608.csv','https://www.six-group.com/dam/download/market-data/statistics/monthly-report/mtd/2026/monthly-trade-data-202607.csv'],allowedMics:new Set(['XSWX']),market:/Swiss|Switzerland|Blue Chip|Mid|Small|Sparks/i,min:200,format:'six-monthly'},
 XMAD:{urls:['https://www.bolsasymercados.es/en/bme-exchange/prices-and-markets/shares/listed-companies.html','https://www.bolsasymercados.es/es/download-center.html'],allowedMics:new Set(['XMAD']),market:/Madrid|Continuous|Mercado Continuo|Main Market/i,min:80,format:'bme-html'},
 XSTO:{urls:['https://www.nasdaq.com/products/data/nordic-baltic/nordic-reference-data-files'],allowedMics:new Set(['XSTO']),market:/Stockholm|STO Equities/i,min:200,format:'nasdaq-nordic-reference'}
};
const cfg=configs[mic];if(!cfg)throw new Error(`Geen goedgekeurde officiële catalogusadapter voor ${mic}; markt blijft geblokkeerd tot een markt-specifieke adapter bestaat`);
let text='',source='';for(const url of cfg.urls){try{const r=await fetch(url,{headers:{'user-agent':'Koersplein/1.0',accept:'text/csv,text/plain,*/*'}});if(r.ok){const t=(await r.text()).replace(/^\uFEFF/,'');if(t.split(/\r?\n/).length>5){text=t;source=url;break}}}catch{}}
if(!text)throw new Error('Officiële product-directory download niet gevonden voor '+m.name);
if(mic==='XSTO'){
 const snapshot='https://www.instinet.com/sites/default/files/blockmatch/stocklist/europe/BlockMatchEurope_20260917.html';
 const r=await fetch(snapshot,{headers:{'user-agent':'Koersplein/1.0',accept:'text/html'}});
 if(!r.ok)throw new Error('STOCKHOLM_SNAPSHOT_GATE: XSTO snapshot niet bereikbaar');
 const html=await r.text(); const shares=[]; const seen=new Set();
 const clean=s=>String(s||'').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&#39;/g,"'").trim();
 for(const tr of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)){
  const cells=[...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(x=>clean(x[1])); if(cells.length<6)continue;
  const [desc,bloomberg,isin,micCode,currency,relevant]=cells;
  if(micCode!=='XSTO'||relevant!=='XSTO'||currency!=='SEK'||!/^[A-Z]{2}[A-Z0-9]{10}$/.test(isin))continue;
  if(/SUBSCR|RIGHT|BTA|TR\b/i.test(desc))continue;
  let symbol=String(bloomberg||'').replace(/\s+SS$/i,'').trim();
  if(!symbol||seen.has(isin))continue;seen.add(isin);shares.push({name:desc.replace(/\s+(ORD|PRF|SDR|SDB|ORD SHS)$/i,''),symbol,providerSymbol:symbol.replace(/([A-Z])$/,'-$1')+'.ST',isin,market:'Nasdaq Stockholm',mic:'XSTO',currency:'SEK'});
 }
 // 2026 Main-Market graduates whose reference-market flag can lag in the 17 Sep broker snapshot.
 const add=[
  ['FLAT B','Flat Capital AB ser. B','SE0016609846'],['SMCRT','SmartCraft Group AB','SE0027597691'],['SILEX','Silex Microsystems AB','SE0025012248'],['PPI','Public Property Invest ASA','NO0013228586'],['OCTV SDB','Octave Intelligence plc SDB','SE0028329433'],['STORY B','Storytel AB ser. B','SE0007439443'],['PDX','Paradox Interactive AB','SE0008294953'],['NTECH','Stockholm Nordtech Group AB','SE0028825042'],['TANGEN B','Tången Industrikapital AB','SE0029278985'],['SALIX','Salix Group AB','SE0028329540'],['ELLOS','Ellos Holding AB','SE0028799429'],['LMGAB','Linjemontage i Grästorp AB','SE0030361606']
 ];
 for(const [symbol,name,isin] of add)if(!seen.has(isin)){seen.add(isin);shares.push({name,symbol,providerSymbol:symbol.replace(/ /g,'-')+'.ST',isin,market:'Nasdaq Stockholm',mic:'XSTO',currency:'SEK'})}
 // Confirmed delistings after/before snapshot must never survive.
 const removed=new Set(['SE0017084361']); // Viva Wine, last trading day 2026-09-22
 const final=shares.filter(x=>!removed.has(x.isin)).sort((a,b)=>a.symbol.localeCompare(b.symbol,'sv'));
 if(final.length!==398)throw new Error(`STOCKHOLM_INSTRUMENT_CLOSURE_GATE: ${final.length}/398 actuele XSTO share instruments; niets publiceren tot exact 398`);
 const fingerprint=(await import('node:crypto')).createHash('sha256').update(JSON.stringify(final.map(x=>[x.isin,x.mic,x.symbol]))).digest('hex');
 const seed={asOf:'2026-09-27',scope:'Nasdaq Stockholm Main Market shares; MIC XSTO; First North excluded',officialControl:{index:'OMXSPI',components:398,asOf:'2026-09-25'},sources:[snapshot,'https://indexes.nasdaq.com/Index/Overview/OMXSPI','https://view.news.eu.nasdaq.com/view?id=bc42af4cf9b929594bacdd76e84831702&lang=en'],fingerprint,shares:final};
 await fs.writeFile('data/stockholm-official-equity-seed.json',JSON.stringify(seed,null,2)+'\n');
 const catalog={exchange:m.name,mic:m.mic,retrievedAt:new Date().toISOString(),source:'Fixed XSTO instrument snapshot reconciled to Nasdaq OMXSPI and official listing/delisting notices',sourceUrl:snapshot,fingerprint,officialCount:398,resolvedCount:398,shares:final};
 await fs.writeFile(`data/euronext-${m.code}.json`,JSON.stringify(catalog,null,2)+'\n');await fs.mkdir('research/output',{recursive:true});await fs.writeFile(`research/output/${m.code}-catalog-gate.json`,JSON.stringify({market:mic,fingerprint,officialCount:398,accepted:398,pass:true,generatedAt:new Date().toISOString()},null,2));
 console.log(JSON.stringify({market:mic,officialCount:398,accepted:398,fingerprint}));process.exit(0);
}
if(mic==='XMAD'){
 const seed=JSON.parse(await fs.readFile('data/madrid-official-equity-seed.json','utf8'));
 const shares=[]; const unresolved=[];
 for(let n=0;n<seed.shares.length;n+=6){
   const batch=await Promise.all(seed.shares.slice(n,n+6).map(async x=>{
     try{
       const u=new URL('https://query2.finance.yahoo.com/v1/finance/search');u.searchParams.set('q',x.isin);u.searchParams.set('quotesCount','12');u.searchParams.set('newsCount','0');
       const r=await fetch(u,{headers:{'user-agent':'Koersplein-history/1.0',accept:'application/json'}});if(!r.ok)return null;
       const p=await r.json();const q=(p.quotes||[]).find(q=>String(q.symbol||'').toUpperCase().endsWith('.MC')&&/MCE|Madrid/i.test(String(q.exchange||'')+' '+String(q.exchDisp||'')));
       if(!q?.symbol)return null;return {...x,symbol:String(q.symbol).replace(/\.MC$/i,''),providerSymbol:String(q.symbol),market:'BME Main Market'};
     }catch{return null}
   }));
   batch.forEach((v,i)=>{if(v)shares.push(v);else unresolved.push(seed.shares[n+i])});
 }
 if(shares.length<110)throw new Error(`Madrid BME ISIN-resolutie onvoldoende: ${shares.length}/${seed.shares.length}; unresolved=${unresolved.length}`);
 const fingerprint=(await import('node:crypto')).createHash('sha256').update(JSON.stringify(seed.shares.map(x=>[x.isin,x.mic]))).digest('hex');
 shares.sort((a,b)=>a.name.localeCompare(b.name,'es'));
 const catalog={exchange:m.name,mic:m.mic,retrievedAt:new Date().toISOString(),source:seed.source,sourceUrl:seed.sourceUrl,fingerprint,officialCount:seed.shares.length,resolvedCount:shares.length,unresolved,shares};
 await fs.writeFile(`data/euronext-${m.code}.json`,JSON.stringify(catalog,null,2)+'\n');await fs.mkdir('research/output',{recursive:true});await fs.writeFile(`research/output/${m.code}-catalog-gate.json`,JSON.stringify({market:mic,source:seed.source,sourceUrl:seed.sourceUrl,fingerprint,officialCount:seed.shares.length,accepted:shares.length,unresolved,pass:unresolved.length===0,generatedAt:new Date().toISOString()},null,2));
 if(unresolved.length)throw new Error(`Madrid catalogus heeft nog ${unresolved.length} onopgeloste officiële aandelen; gate blijft dicht`);
 console.log(JSON.stringify({market:mic,officialCount:seed.shares.length,accepted:shares.length,fingerprint,source:seed.source}));
 process.exit(0);
}
if(mic==='XSWX'){
 const lines=text.split(/\r?\n/).filter(Boolean);
 const delimiter=[';',',','\t'].sort((a,b)=>lines[0].split(b).length-lines[0].split(a).length)[0];
 const parse=line=>{const o=[];let cur='',q=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(q&&line[i+1]==='"'){cur+='"';i++}else q=!q}else if(ch===delimiter&&!q){o.push(cur.trim());cur=''}else cur+=ch}o.push(cur.trim());return o};
 const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'');
 const headerIndex=lines.findIndex(line=>{const n=parse(line).map(norm);return n.includes('isin')&&(n.some(x=>/symbol|ticker|valor|security/.test(x)))});
 if(headerIndex<0)throw new Error('SIX monthly trade CSV: ISIN/symbol header niet gevonden');
 const header=parse(lines[headerIndex]),hn=header.map(norm);
 const idx=(...patterns)=>hn.findIndex(h=>patterns.some(p=>h===norm(p)||h.includes(norm(p))));
 const iIsin=idx('isin'),iSym=idx('symbol','ticker','trading symbol'),iValor=idx('valor number','valor'),iName=idx('name','security name','instrument name','security','instrument'),iType=idx('six product segment desc','security type','instrument type','product group','trading segment'),iSub=idx('instrument sub type'),iCur=idx('trading currency code','currency','trading currency');
 if(iIsin<0||iName<0)throw new Error('SIX monthly trade CSV onverwachte kolommen: '+JSON.stringify(header));
 const shares=[],seen=new Set(),rejected={missingIdentity:0,nonEquity:0,duplicateIsin:0};
 for(const line of lines.slice(headerIndex+1)){const r=parse(line),isin=String(r[iIsin]||'').toUpperCase(),symbol=String((iSym>=0?r[iSym]:'')||(iValor>=0?r[iValor]:'')).trim(),name=String((iName>=0?r[iName]:'')||symbol).trim(),type=(String(iType>=0?r[iType]:'')+' '+String(iSub>=0?r[iSub]:'')).toLowerCase(),currency=String(iCur>=0?r[iCur]:'').toUpperCase();
  if(!/^[A-Z]{2}[A-Z0-9]{10}$/.test(isin)||!symbol){rejected.missingIdentity++;continue}
  if(type&&!/(share|equity|blue chip|mid|small|spark)/i.test(type)){rejected.nonEquity++;continue}
  if(/(bond|etf|etp|fund|warrant|right|option|structured|certificate|derivative)/i.test(type)){rejected.nonEquity++;continue}
  if(seen.has(isin)){rejected.duplicateIsin++;continue}seen.add(isin);shares.push({name,symbol,isin,market:'SIX Swiss Exchange',mic:'XSWX',currency:currency||undefined});
 }
 if(shares.length<cfg.min)throw new Error(`Te weinig bewezen Zürich-aandelen uit officiële SIX Monthly Trade Data: ${shares.length}; rejected=${JSON.stringify(rejected)}`);
 // SIX Monthly Trade Data is the authoritative universe. Resolve public .SW tickers by ISIN for display/history routing.
 for(let n=0;n<shares.length;n+=6){await Promise.all(shares.slice(n,n+6).map(async x=>{try{const u=new URL('https://query2.finance.yahoo.com/v1/finance/search');u.searchParams.set('q',x.isin);u.searchParams.set('quotesCount','10');u.searchParams.set('newsCount','0');const r=await fetch(u,{headers:{'user-agent':'Koersplein-history/1.0',accept:'application/json'}});if(!r.ok)return;const p=await r.json();const q=(p.quotes||[]).find(q=>String(q.symbol||'').toUpperCase().endsWith('.SW'));if(q?.symbol)x.symbol=String(q.symbol).replace(/\.SW$/i,'');}catch{}}));}
 shares.sort((a,b)=>a.name.localeCompare(b.name,'de-CH'));
 const fingerprint=(await import('node:crypto')).createHash('sha256').update(JSON.stringify(shares.map(x=>[x.isin,x.mic,x.symbol]))).digest('hex');
 const catalog={exchange:m.name,mic:m.mic,retrievedAt:new Date().toISOString(),source,fingerprint,rawRows:lines.length-headerIndex-1,rejected,shares};
 await fs.writeFile(`data/euronext-${m.code}.json`,JSON.stringify(catalog,null,2)+'\n');await fs.mkdir('research/output',{recursive:true});await fs.writeFile(`research/output/${m.code}-catalog-gate.json`,JSON.stringify({market:mic,source,fingerprint,rawRows:catalog.rawRows,accepted:shares.length,rejected,pass:true,generatedAt:new Date().toISOString()},null,2));console.log(JSON.stringify({market:mic,rawRows:catalog.rawRows,accepted:shares.length,rejected,fingerprint,source}));process.exit(0);
}
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
 for(const line of lines.slice(headerIndex+1)){const r=parse(line),isin=String(r[iIsin]||'').toUpperCase(),symbol=String(r[iSym]||''),name=String((iName>=0?r[iName]:'')||symbol),type=String(iType>=0?r[iType]:'').toLowerCase(),rowMic=String(iMic>=0?r[iMic]:'XETR').toUpperCase();if(!/^[A-Z]{2}[A-Z0-9]{10}$/.test(isin)||!symbol){rejected.missingIdentity++;continue}if(type&&/(bond|certificate|warrant|fund|etf|etn|etc|option|future|right|subscription|structured|derivative)/i.test(type)){rejected.nonEquity++;continue}if(rowMic&&rowMic!=='XETR'){rejected.wrongMic++;continue}if(seen.has(isin)){rejected.duplicateIsin++;continue}seen.add(isin);shares.push({name,symbol,isin,market:'Xetra',mic:'XETR'});}
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
