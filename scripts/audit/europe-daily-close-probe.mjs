import fs from 'node:fs/promises';
const root=new URL('../../',import.meta.url);
const markets=JSON.parse(await fs.readFile(new URL('data/markets.json',root))).venues.find(v=>v.id==='euronext').markets;
const date='2026-10-16', previous='2026-10-15';
const suffixes={XAMS:'.AS',XBRU:'.BR',XPAR:'.PA',XMIL:'.MI',XOSL:'.OL',XLIS:'.LS',XSWX:'.SW',XSTO:'.ST',XCSE:'.CO',XDUB:'.IR',XETR:'.DE',XMAD:'.MC',XHEL:'.HE',XATH:'.AT',XWBO:'.VI',XPRA:'.PR',XBUD:'.BD',XBSE:'.RO',XBUL:'.BG',XWAR:'.WA',XLON:'.L',XICE:'.IC',XZAG:'.ZA',XLJU:'.LJ',XBRA:'.SK',XLUX:'.LU',XMAL:'.MT',XCYS:'.CY',XTAL:'.TL',XRIS:'.RG',XLIT:'.VS'};
const results=[];
const retryMarkets=new Set(['XSWX','XBUL','XZAG','XLJU','XBRA','XMAL','XCYS','XTAL','XRIS','XLIT']);
for(const market of markets){
 const catalog=JSON.parse(await fs.readFile(new URL('data/'+market.sharesData,root)));
 const samples=retryMarkets.has(market.mic)?catalog.shares.slice(0,10):[catalog.shares.find(s=>s.providerSymbol&&s.isin)||catalog.shares.find(s=>s.symbol&&s.isin)];
 for(const sample of samples){
 const ticker=sample?.providerSymbol?.match(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/)?sample?.symbol:(sample?.providerSymbol||sample?.symbol);
 const row={mic:market.mic,market:market.name,ticker,isin:sample?.isin||null,date:null,open:null,close:null,provider:'Yahoo chart',status:'not_tested'};
 if(!ticker){row.status='no_provider_symbol';results.push(row);console.log(JSON.stringify(row));continue}
 try{
  const end=Math.floor(Date.parse('2026-10-18T00:00:00Z')/1000);
  const start=Math.floor(Date.parse('2026-10-14T00:00:00Z')/1000);
  const candidate=ticker.includes('.')?ticker:ticker+(suffixes[market.mic]||'');
  row.requestedTicker=candidate;
  const url='https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(candidate)+'?period1='+start+'&period2='+end+'&interval=1d';
  const res=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0'} ,signal:AbortSignal.timeout(12000)});
  if(!res.ok){row.status='http_'+res.status;results.push(row);console.log(JSON.stringify(row));continue}
  const body=await res.json();const chart=body.chart?.result?.[0];const q=chart?.indicators?.quote?.[0];const times=chart?.timestamp||[];
  const bars=times.map((t,i)=>({date:new Date(t*1000).toISOString().slice(0,10),open:q?.open?.[i],close:q?.close?.[i]})).filter(b=>b.date===date||b.date===previous).filter(b=>Number.isFinite(b.open)&&Number.isFinite(b.close));
  const latest=bars.at(-1);
  if(latest){row.date=latest.date;row.open=latest.open;row.close=latest.close;row.status=latest.open<=0||latest.close<=0?'invalid_ohlc':latest.date===date?'today':'yesterday'}else row.status='no_dated_bar';
 }catch(e){row.status='error';row.error=String(e.message).slice(0,150)}
 results.push(row);
 console.log(JSON.stringify(row));
 if(row.status==='today'||row.status==='yesterday')break;
 }
}
await fs.mkdir('research/output/audit',{recursive:true});
await fs.writeFile('research/output/audit/europe-daily-close-20261016.json',JSON.stringify({date,previous,markets:results.length,results},null,2));
