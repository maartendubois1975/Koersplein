// Read-only source-volume validation for same-cutoff transitions; never imports prices.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {YahooChartProvider} from '../history/providers/yahoo-chart.mjs';
const groups={"XMIL":["ADV","DOT"],"XSTO":["HAKI A","MSON A","MTG A","SVEAF","SVOL A","VEFAB"],"XOSL":["VVL"],"XCSE":["OKEAC","GERHSP","GYLD A","PARKST A","PRIMOF"],"XBSE":["GREEN","CBC","MECF","CMF","BCM","PREH","ELJ","ECT","CNTE","CAOR","UZT","BIO","MCAB","MFC"],"XPAR":["MONT"],"XMAD":["AYC","CEV","CLEO","DESA","LIW","TRG","UBS"],"XPRA":["ENERG","RMSME","TOMA","EMAN","M2C","M1997"],"XMAL":["MTP"],"XICE":["BRIM","HAMP","JBTM","REITIR","SVN","SKEL","SYN"],"XAMS":["FAGR","SGO"],"XSWX":["VILN","WIHN","ALCE","LISNE","SCHNE","ALPN"],"XWBO":["ACAG","BKS","BTS","STM"],"XBRU":["INGA","SGO","TTE"],"XETR":["LIV","ERWE","LXI","PCX","PFSE"],"XWAR":["CPI","DGA","EST","ENG","EUC","IZB","KMP","KVT","APL","LES","MAN","MEG","MZA","NTU","PBG","QNT","RHD","RDN","SKL","THG","TRI","WIK","YAN"],"XHEL":["DOV1V"]};
const fileMap={"XMIL":"milan","XSTO":"stockholm","XOSL":"oslo","XCSE":"copenhagen","XBSE":"bucharest","XPAR":"paris","XMAD":"madrid","XPRA":"prague","XMAL":"malta","XICE":"reykjavik","XAMS":"amsterdam","XSWX":"zurich","XWBO":"vienna","XBRU":"brussels","XETR":"frankfurt","XWAR":"warsaw","XHEL":"helsinki"};
const provider=new YahooChartProvider(),targets=[];
for(const [mic,symbols] of Object.entries(groups)){
 const catalog=JSON.parse(await readFile('data/euronext-'+fileMap[mic]+'.json','utf8'));
 for(const symbol of symbols){
  const instrument=(catalog.shares||[]).find(s=>s.symbol===symbol);
  targets.push({mic,symbol,isin:instrument?.isin||null,instrument});
 }
}
const results=new Array(targets.length);let next=0;
async function worker(){
 while(next<targets.length){
  const index=next++,target=targets[index],instrument=target.instrument;
  const row={mic:target.mic,symbol:target.symbol,isin:target.isin,status:'NOT_CHECKED',volume:null,hasCompleteOhlc:false};
  try{
   if(!instrument){row.status='CATALOG_MISSING';results[index]=row;continue;}
   if(!provider.supports(instrument)){row.status='UNSUPPORTED_IDENTITY';results[index]=row;continue;}
   const response=await provider.fetchDaily(instrument,{startDate:'2026-10-23',endDate:'2026-10-23',includeIncompleteBars:true,signal:AbortSignal.timeout(5000)});
   const bar=response.bars.find(b=>b.date==='2026-10-23');
   row.status=bar?'SOURCE_BAR':'NO_SOURCE_BAR';
   row.volume=bar?.volume??null;
   row.hasCompleteOhlc=!!bar&&[bar.open,bar.high,bar.low,bar.close].every(v=>Number.isFinite(v));
  }catch(error){row.status='SOURCE_ERROR';row.error=String(error?.message||error).slice(0,150);}
  results[index]=row;
 }
}
await Promise.all(Array.from({length:4},()=>worker()));
const summary={requested:results.length,sourceBars:results.filter(r=>r.status==='SOURCE_BAR').length,positiveVolume:results.filter(r=>r.status==='SOURCE_BAR'&&r.volume>0).length,zeroVolume:results.filter(r=>r.status==='SOURCE_BAR'&&r.volume===0).length,nullVolume:results.filter(r=>r.status==='SOURCE_BAR'&&r.volume===null).length,unavailable:results.filter(r=>r.status!=='SOURCE_BAR').length};
await mkdir('research/output',{recursive:true});
await writeFile('research/output/yahoo-transition-volume-probe.json',JSON.stringify({mode:'READ_ONLY_TRANSITION_SOURCE_VOLUME',cutoff:'2026-10-23',generatedAt:new Date().toISOString(),summary,results,warning:'Source-volume evidence only; no source prices, no production mutations, no OHLC validity assertion without exchange corroboration.'},null,2)+'\n');
console.log('YAHOO_TRANSITION_VOLUME_PROBE',JSON.stringify(summary));
