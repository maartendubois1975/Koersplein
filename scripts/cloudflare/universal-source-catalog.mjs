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
 XSTO:{urls:['https://www.nasdaq.com/products/data/nordic-baltic/nordic-reference-data-files'],allowedMics:new Set(['XSTO']),market:/Stockholm|STO Equities/i,min:200,format:'nasdaq-nordic-reference'},
 XCSE:{urls:['https://indexes.nasdaqomx.com/Index/Overview/OMXCPI'],allowedMics:new Set(['XCSE']),market:/Copenhagen/i,min:115,format:'nasdaq-omxcpi-seed'},
 XHEL:{urls:['https://indexes.nasdaq.com/Index/Overview/OMXHGI','https://indexes.nasdaqomx.com/Index/Overview/OMXHGI'],allowedMics:new Set(['XHEL']),market:/Helsinki/i,min:145,format:'nasdaq-omxhgi-seed',officialSupplementNotices:['https://view.news.eu.nasdaq.com/view?id=b4e31667684eb0ad49bd08e840d267e6e&lang=en']},
 XICE:{urls:['https://indexes.nasdaqomx.com/Index/Overview/OMXIGI','https://indexes.nasdaqomx.com/Index/Overview/OMXIPI'],allowedMics:new Set(['XICE']),market:/Iceland/i,min:27,format:'nasdaq-omxigi-seed'}
};
const cfg=configs[mic];if(!cfg)throw new Error(`Geen goedgekeurde officiële catalogusadapter voor ${mic}; markt blijft geblokkeerd tot een markt-specifieke adapter bestaat`);
let text='',source='';for(const url of cfg.urls){try{const r=await fetch(url,{headers:{'user-agent':mic==='XCSE'?'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36':'Koersplein/1.0',accept:mic==='XCSE'?'text/html,application/xhtml+xml':'text/csv,text/plain,*/*'}});if(r.ok){const t=(await r.text()).replace(/^\uFEFF/,'');if((mic==='XCSE'&&t.length>500)||t.split(/\r?\n/).length>5){text=t;source=url;break}}}catch{}}
if(!text)throw new Error('Officiële product-directory download niet gevonden voor '+m.name);
if(mic==='XCSE'){
 const expected=115;
 if(!/# of Components[\s\S]{0,200}115|Components[\s\S]{0,120}115/i.test(text))
   throw new Error('COPENHAGEN_OFFICIAL_COUNT_GATE: Nasdaq OMXCPI does not prove 115 components');
 const instinetUrl='https://www.instinet.com/sites/default/files/blockmatch/stocklist/europe/BlockMatchEurope_20260916.html';
 const ir=await fetch(instinetUrl,{headers:{'user-agent':'Koersplein/1.0',accept:'text/html'}});
 if(!ir.ok)throw new Error('COPENHAGEN_FREE_DISCOVERY: Instinet stock list unavailable '+ir.status);
 const ih=await ir.text();const candidates=[];const seenIsin=new Set();
 for(const tr of ih.matchAll(new RegExp('<tr[^>]*>([\\s\\S]*?)</tr>','gi'))){
   const cells=[...tr[1].matchAll(new RegExp('<td[^>]*>([\\s\\S]*?)</td>','gi'))].map(x=>x[1].replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim());
   if(cells.length<6)continue;
   const [name,bb,isin,micCode,currency,relevantMarket]=cells;
   if(micCode!=='XCSE'||relevantMarket!=='XCSE'||!isin||seenIsin.has(isin))continue;
   // Venue lists may also contain temporary subscription rights/warrants; OMXCPI equity basket does not.
   if(/SUBSCR|RIGHTS?|WARRANT|TEMPORARY RIGHTS?/i.test(name))continue;
   seenIsin.add(isin);candidates.push({isin,name,bb,currency,sourceUrl:instinetUrl});
 }
 const discoverySource=instinetUrl;
 if(candidates.length!==expected)throw new Error(`COPENHAGEN_FREE_DISCOVERY: Instinet XCSE main-market identities ${candidates.length}/${expected}`);

 if(candidates.length!==expected)throw new Error(`COPENHAGEN_FREE_DISCOVERY: ${candidates.length}/${expected} identities`);
 const shares=[]; const unresolved=[];
 const copenhagenSymbolFallback={
  'DK0010255975':'MTHH.CO',
  'DK0061273125':'SHAPE.CO',
  'DK0064983373':'NEWCAP.CO',
  'DK0010247600':'GYLD-B.CO'
 };
 for(let n=0;n<candidates.length;n+=6){
   const batch=await Promise.all(candidates.slice(n,n+6).map(async x=>{try{
     const u=new URL('https://query2.finance.yahoo.com/v1/finance/search');u.searchParams.set('q',x.isin);u.searchParams.set('quotesCount','12');u.searchParams.set('newsCount','0');
     const r=await fetch(u,{headers:{'user-agent':'Koersplein-history/1.0',accept:'application/json'}});if(!r.ok)return null;
     const p=await r.json();const q=(p.quotes||[]).find(q=>String(q.symbol||'').toUpperCase().endsWith('.CO'));
     const ps=q?.symbol?String(q.symbol):copenhagenSymbolFallback[x.isin];if(!ps)return null;return {company:q?.longname||q?.shortname||x.name,name:q?.longname||q?.shortname||x.name,symbol:ps.replace(/\.CO$/i,'').replace(/-/g,' '),ticker:ps.replace(/\.CO$/i,''),isin:x.isin,mic:'XCSE',segment:'Main Market',currency:'DKK',providerSymbol:ps,identitySource:x.sourceUrl,identityResolution:q?.symbol?'YAHOO_ISIN':'FREE_SEED_SYMBOL_FALLBACK'};
   }catch{return null}}));
   batch.forEach((v,i)=>{if(v)shares.push(v);else unresolved.push(candidates[n+i])});
 }
 const uniq=new Map(shares.map(x=>[x.isin,x]));const resolved=[...uniq.values()].sort((a,b)=>a.name.localeCompare(b.name,'da'));
 if(resolved.length!==expected)throw new Error(`COPENHAGEN_IDENTITY_GATE: resolved ${resolved.length}/${expected}; unresolved=${JSON.stringify(unresolved.map(x=>({name:x.name,isin:x.isin,bb:x.bb})))}; discovered=${candidates.length}`);
 const fingerprint=(await import('node:crypto')).createHash('sha256').update(JSON.stringify(resolved.map(x=>[x.isin,x.providerSymbol]))).digest('hex');
 const catalog={exchange:m.name,mic:'XCSE',retrievedAt:new Date().toISOString(),source:'Nasdaq OMXCPI official count + free public constituent discovery + Yahoo ISIN resolution',sourceUrl:'https://indexes.nasdaqomx.com/Index/Overview/OMXCPI',officialCount:expected,resolvedCount:resolved.length,fingerprint,discoverySource,discoveryPolicy:'NORDIC_FREE_DISCOVERY',shares:resolved};
 await fs.writeFile(`data/euronext-${m.code}.json`,JSON.stringify(catalog,null,2)+String.fromCharCode(10));await fs.mkdir('research/output',{recursive:true});
 await fs.writeFile(`research/output/${m.code}-catalog-gate.json`,JSON.stringify({market:mic,officialAuthority:'Nasdaq OMXCPI',officialCount:expected,accepted:resolved.length,discovered:candidates.length,unresolved,fingerprint,pass:true,discoveryPolicy:'NORDIC_FREE_DISCOVERY',generatedAt:new Date().toISOString()},null,2));
 console.log(JSON.stringify({market:mic,officialCount:expected,accepted:resolved.length,fingerprint,discoveryPolicy:'NORDIC_FREE_DISCOVERY'}));process.exit(0);
}
if(mic==='XHEL'){
 const expected=145;
 if(!/# of Components[\s\S]{0,200}145|Components[\s\S]{0,120}145/i.test(text))throw new Error('HELSINKI_OFFICIAL_COUNT_GATE: Nasdaq OMXH does not prove 145 components');
 const instinetUrl='https://www.instinet.com/sites/default/files/blockmatch/stocklist/europe/BlockMatchEurope_20260916.html';
 const ir=await fetch(instinetUrl,{headers:{'user-agent':'Koersplein/1.0',accept:'text/html'}});if(!ir.ok)throw new Error('HELSINKI_FREE_DISCOVERY: Instinet '+ir.status);
 const ih=await ir.text(), candidates=[],seen=new Set();
 for(const tr of ih.matchAll(new RegExp('<tr[^>]*>([\\s\\S]*?)</tr>','gi'))){const cells=[...tr[1].matchAll(new RegExp('<td[^>]*>([\\s\\S]*?)</td>','gi'))].map(x=>x[1].replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim());if(cells.length<6)continue;const [name,bb,isin,micCode,currency,relevantMarket]=cells;if(micCode!=='XHEL'||relevantMarket!=='XHEL'||!isin||seen.has(isin)||/SUBSCR|RIGHTS?|WARRANT|TEMPORARY RIGHTS?/i.test(name))continue;seen.add(isin);candidates.push({isin,name,bb,currency,sourceUrl:instinetUrl});}
 if(candidates.length<expected&&cfg.officialSupplementNotices?.length){
   // Generic Nasdaq Nordic N-1 repair: only an official exchange notice may supplement
   // the free identity feed. The official component gate itself is never weakened.
   for(const noticeUrl of cfg.officialSupplementNotices){
     if(candidates.length>=expected)break;
     try{
       const nr=await fetch(noticeUrl,{headers:{'user-agent':'Koersplein/1.0',accept:'text/html'}});
       if(!nr.ok)continue; const nh=await nr.text();
       const tradingCode=(nh.match(/Trading code:\s*<[^>]*>?\s*([A-Z0-9]+)/i)||nh.match(/Trading code:\s*([A-Z0-9]+)/i))?.[1];
       const isin=(nh.match(/ISIN(?: code)?:\s*<[^>]*>?\s*([A-Z]{2}[A-Z0-9]{10})/i)||nh.match(/ISIN(?: code)?:\s*([A-Z]{2}[A-Z0-9]{10})/i))?.[1];
       const listingDate=(nh.match(/Listing date:\s*<[^>]*>?\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})/i)||nh.match(/Listing date:\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})/i))?.[1];
       if(tradingCode&&isin&&!seen.has(isin)){
         seen.add(isin);candidates.push({isin,name:tradingCode,bb:tradingCode,currency:'EUR',sourceUrl:noticeUrl,officialSupplement:true,listingDate:listingDate?new Date(listingDate).toISOString().slice(0,10):null});
       }
     }catch{}
   }
 }
 if(candidates.length!==expected)throw new Error(`HELSINKI_FREE_DISCOVERY: identities ${candidates.length}/${expected}`);
 const shares=[],unresolved=[];
 for(let n=0;n<candidates.length;n+=6){const batch=await Promise.all(candidates.slice(n,n+6).map(async x=>{try{const u=new URL('https://query2.finance.yahoo.com/v1/finance/search');u.searchParams.set('q',x.isin);u.searchParams.set('quotesCount','12');u.searchParams.set('newsCount','0');const r=await fetch(u,{headers:{'user-agent':'Koersplein-history/1.0',accept:'application/json'}});if(!r.ok)return null;const p=await r.json(),q=(p.quotes||[]).find(q=>String(q.symbol||'').toUpperCase().endsWith('.HE'));if(!q?.symbol)return null;const ps=String(q.symbol);return {company:q.longname||q.shortname||x.name,name:q.longname||q.shortname||x.name,symbol:ps.replace(/\.HE$/i,'').replace(/-/g,' '),ticker:ps.replace(/\.HE$/i,''),isin:x.isin,mic:'XHEL',segment:'Main Market',currency:'EUR',providerSymbol:ps,identitySource:x.sourceUrl,identityResolution:'YAHOO_ISIN'};}catch{return null}}));batch.forEach((v,i)=>v?shares.push(v):unresolved.push(candidates[n+i]));}
 for(const x of unresolved.filter(x=>x.officialSupplement)){
   shares.push({company:x.name,name:x.name,symbol:x.bb,ticker:x.bb,isin:x.isin,mic:'XHEL',segment:'Main Market',currency:'EUR',providerSymbol:null,identitySource:x.sourceUrl,identityResolution:'OFFICIAL_EXCHANGE_NOTICE',listingDate:x.listingDate});
 }
 const stillUnresolved=unresolved.filter(x=>!x.officialSupplement);
 const resolved=[...new Map(shares.map(x=>[x.isin,x])).values()].sort((a,b)=>a.name.localeCompare(b.name,'fi'));if(resolved.length!==expected||stillUnresolved.length)throw new Error(`HELSINKI_IDENTITY_GATE: resolved ${resolved.length}/${expected}; unresolved=${JSON.stringify(stillUnresolved.map(x=>({name:x.name,isin:x.isin,bb:x.bb})))}`);
 const fingerprint=(await import('node:crypto')).createHash('sha256').update(JSON.stringify(resolved.map(x=>[x.isin,x.providerSymbol]))).digest('hex'),catalog={exchange:m.name,mic:'XHEL',retrievedAt:new Date().toISOString(),source:'Nasdaq OMXH official count + free Instinet XHEL identities + Yahoo ISIN resolution',sourceUrl:'https://indexes.nasdaq.com/Index/Overview/OMXHGI',officialCount:expected,resolvedCount:resolved.length,fingerprint,discoverySource:instinetUrl,discoveryPolicy:'NORDIC_FREE_DISCOVERY',shares:resolved};await fs.writeFile(`data/euronext-${m.code}.json`,JSON.stringify(catalog,null,2)+String.fromCharCode(10));console.log(JSON.stringify({market:mic,officialCount:expected,accepted:resolved.length,fingerprint,preparedOnly:true}));process.exit(0);
}


if(mic==='XICE'){
 const expected=27;
 if(!/# of Components[\s\S]{0,200}27|Components[\s\S]{0,120}27/i.test(text))throw new Error('ICELAND_OFFICIAL_COUNT_GATE: Nasdaq OMXIGI/OMXIPI does not prove 27 components');
 const instinetUrl='https://www.instinet.com/sites/default/files/blockmatch/stocklist/europe/BlockMatchEurope_20260916.html';
 const ir=await fetch(instinetUrl,{headers:{'user-agent':'Koersplein/1.0',accept:'text/html'}});if(!ir.ok)throw new Error('ICELAND_FREE_DISCOVERY: Instinet '+ir.status);
 const ih=await ir.text(),candidates=[],seen=new Set();
 for(const tr of ih.matchAll(new RegExp('<tr[^>]*>([\\s\\S]*?)</tr>','gi'))){const cells=[...tr[1].matchAll(new RegExp('<td[^>]*>([\\s\\S]*?)</td>','gi'))].map(x=>x[1].replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/\\s+/g,' ').trim());if(cells.length<6)continue;const [name,bb,isin,micCode,currency,relevantMarket]=cells;if(micCode!=='XICE'||relevantMarket!=='XICE'||!isin||seen.has(isin)||/SUBSCR|RIGHTS?|WARRANT|TEMPORARY RIGHTS?/i.test(name))continue;seen.add(isin);candidates.push({isin,name,bb,currency,sourceUrl:instinetUrl});}
 if(candidates.length!==expected)throw new Error(`ICELAND_FREE_DISCOVERY: identities ${candidates.length}/${expected}`);
 const shares=[],unresolved=[];
 for(let n=0;n<candidates.length;n+=6){const batch=await Promise.all(candidates.slice(n,n+6).map(async x=>{try{const u=new URL('https://query2.finance.yahoo.com/v1/finance/search');u.searchParams.set('q',x.isin);u.searchParams.set('quotesCount','12');u.searchParams.set('newsCount','0');const r=await fetch(u,{headers:{'user-agent':'Koersplein-history/1.0',accept:'application/json'}});if(!r.ok)return null;const p=await r.json(),q=(p.quotes||[]).find(q=>String(q.symbol||'').toUpperCase().endsWith('.IC'));if(!q?.symbol)return null;const ps=String(q.symbol);return {company:q.longname||q.shortname||x.name,name:q.longname||q.shortname||x.name,symbol:ps.replace(/\\.IC$/i,'').replace(/-/g,' '),ticker:ps.replace(/\\.IC$/i,''),isin:x.isin,mic:'XICE',segment:'Main Market',currency:'ISK',providerSymbol:ps,identitySource:x.sourceUrl,identityResolution:'YAHOO_ISIN'};}catch{return null}}));batch.forEach((v,i)=>v?shares.push(v):unresolved.push(candidates[n+i]));}
 const resolved=[...new Map(shares.map(x=>[x.isin,x])).values()].sort((a,b)=>a.name.localeCompare(b.name,'is'));if(resolved.length!==expected)throw new Error(`ICELAND_IDENTITY_GATE: resolved ${resolved.length}/${expected}; unresolved=${JSON.stringify(unresolved.map(x=>({name:x.name,isin:x.isin,bb:x.bb})))}`);
 const fingerprint=(await import('node:crypto')).createHash('sha256').update(JSON.stringify(resolved.map(x=>[x.isin,x.providerSymbol]))).digest('hex'),catalog={exchange:m.name,mic:'XICE',retrievedAt:new Date().toISOString(),source:'Nasdaq OMX Iceland All-Share official 27 count + free Instinet XICE identities + Yahoo ISIN resolution',sourceUrl:'https://indexes.nasdaqomx.com/Index/Overview/OMXIGI',officialCount:expected,resolvedCount:resolved.length,fingerprint,discoverySource:instinetUrl,discoveryPolicy:'NORDIC_FREE_DISCOVERY',shares:resolved};await fs.writeFile(`data/euronext-${m.code}.json`,JSON.stringify(catalog,null,2)+String.fromCharCode(10));console.log(JSON.stringify({market:mic,officialCount:expected,accepted:resolved.length,fingerprint,preparedOnly:true}));process.exit(0);
}

if(mic==='XSTO'){
 const seed=JSON.parse(await fs.readFile('data/stockholm-official-equity-seed.json','utf8'));
 const koerspleinExcluded=new Set(['BESQAB PREF B','CORE D','CORE PREF','EMIL PREF','FPAR D','INTEA D','K2A PREF','NP3 PREF','SAGA D','SBB D','VOLO PREF','ALIV SDB','ALVO SDB','ARION SDB']);
 const shares=(seed.shares||[]).filter(x=>!koerspleinExcluded.has(x.symbol)).map(x=>({...x,mic:'XSTO',market:'Nasdaq Stockholm Main Market'}));
 const invalid=shares.filter(x=>!x.name||!x.symbol||!x.isin||x.mic!=='XSTO'||!['Large Cap','Mid Cap','Small Cap'].includes(x.segment)||!x.providerSymbol);
 const seenIsin=new Set(),seenTicker=new Set();const duplicates=[];
 for(const x of shares){if(seenIsin.has(x.isin)||seenTicker.has(x.symbol.toUpperCase()))duplicates.push(x);seenIsin.add(x.isin);seenTicker.add(x.symbol.toUpperCase());}
 if(invalid.length||duplicates.length||shares.length!==398)throw new Error(`STOCKHOLM_FIXED_SEED_GATE: count=${shares.length}, invalid=${invalid.length}, duplicates=${duplicates.length}; verwacht exact 398 gewone/verhandelbare OMXSPI-aandelen`);
 const fingerprint=(await import('node:crypto')).createHash('sha256').update(JSON.stringify(shares.map(x=>[x.isin,x.mic,x.symbol,x.segment,x.providerSymbol]))).digest('hex');
 const catalog={exchange:m.name,mic:'XSTO',retrievedAt:new Date().toISOString(),source:seed.source,sourceUrl:seed.sourceUrl,fingerprint,officialCount:shares.length,resolvedCount:shares.length,fixedSeed:true,shares};
 await fs.writeFile(`data/euronext-${m.code}.json`,JSON.stringify(catalog,null,2)+'\n');await fs.mkdir('research/output',{recursive:true});await fs.writeFile(`research/output/${m.code}-catalog-gate.json`,JSON.stringify({market:mic,source:seed.source,sourceUrl:seed.sourceUrl,fingerprint,officialCount:shares.length,accepted:shares.length,invalid:invalid.length,duplicates:duplicates.length,pass:true,fixedSeed:true,generatedAt:new Date().toISOString()},null,2));
 console.log(JSON.stringify({market:mic,officialCount:shares.length,accepted:shares.length,fingerprint,fixedSeed:true}));process.exit(0);
}
if(mic==='XMAD'){
 const seed=JSON.parse(await fs.readFile('data/madrid-official-equity-seed.json','utf8'));
 const shares=[]; const unresolved=[];
 for(let n=0;n<seed.shares.length;n+=6){
   const batch=await Promise.all(seed.shares.slice(n,n+6).map(async x=>{
     try{
       if(x.providerSymbol||x.identityResolution==='OFFICIAL_OTHER_VENUE_DATA_UNAVAILABLE')return {...x,market:'BME Main Market'};
       const u=new URL('https://query2.finance.yahoo.com/v1/finance/search');u.searchParams.set('q',x.isin);u.searchParams.set('quotesCount','12');u.searchParams.set('newsCount','0');
       const r=await fetch(u,{headers:{'user-agent':'Koersplein-history/1.0',accept:'application/json'}});if(!r.ok)return null;
       const p=await r.json();let q=(p.quotes||[]).find(q=>String(q.symbol||'').toUpperCase().endsWith('.MC')&&/MCE|Madrid/i.test(String(q.exchange||'')+' '+String(q.exchDisp||'')));
       // Generic Madrid identity fallback: some valid BME equities are not indexed by ISIN
       // in Yahoo search. Retry the same registered free route by official company name,
       // but still accept only an explicit Madrid (.MC) equity result.
       if(!q?.symbol){
         const nurl=new URL('https://query2.finance.yahoo.com/v1/finance/search');nurl.searchParams.set('q',x.name);nurl.searchParams.set('quotesCount','20');nurl.searchParams.set('newsCount','0');
         const nr=await fetch(nurl,{headers:{'user-agent':'Koersplein-history/1.0',accept:'application/json'}});
         if(nr.ok){const np=await nr.json();q=(np.quotes||[]).find(q=>String(q.symbol||'').toUpperCase().endsWith('.MC')&&/MCE|Madrid/i.test(String(q.exchange||'')+' '+String(q.exchDisp||'')));}
       }
       if(!q?.symbol)return null;return {...x,symbol:String(q.symbol).replace(/\.MC$/i,''),providerSymbol:String(q.symbol),market:'BME Main Market',identityResolution:'YAHOO_ISIN_OR_OFFICIAL_NAME'};
     }catch{return null}
   }));
   batch.forEach((v,i)=>{if(v)shares.push(v);else unresolved.push(seed.shares[n+i])});
 }
 if(shares.length<110)throw new Error(`Madrid BME ISIN-resolutie onvoldoende: ${shares.length}/${seed.shares.length}; unresolved=${unresolved.length}`);
 const fingerprint=(await import('node:crypto')).createHash('sha256').update(JSON.stringify(seed.shares.map(x=>[x.isin,x.mic]))).digest('hex');
 shares.sort((a,b)=>a.name.localeCompare(b.name,'es'));
 const catalog={exchange:m.name,mic:m.mic,retrievedAt:new Date().toISOString(),source:seed.source,sourceUrl:seed.sourceUrl,fingerprint,officialCount:seed.shares.length,resolvedCount:shares.length,unresolved,shares};
 await fs.writeFile(`data/euronext-${m.code}.json`,JSON.stringify(catalog,null,2)+'\n');await fs.mkdir('research/output',{recursive:true});await fs.writeFile(`research/output/${m.code}-catalog-gate.json`,JSON.stringify({market:mic,source:seed.source,sourceUrl:seed.sourceUrl,fingerprint,officialCount:seed.shares.length,accepted:shares.length,unresolved,pass:unresolved.length===0,generatedAt:new Date().toISOString()},null,2));
 if(unresolved.length){await fs.writeFile('research/output/madrid-unresolved.json',JSON.stringify(unresolved,null,2)+'\n');throw new Error(`Madrid catalogus heeft nog ${unresolved.length} onopgeloste officiële aandelen: ${unresolved.map(x=>x.isin).join(',')}`);}
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
