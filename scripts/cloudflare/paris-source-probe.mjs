import fs from 'node:fs/promises';
import {parseEuronextHistoryRows,decodeEuronextBody,euronextProviderMic} from '../history/providers/euronext-live.mjs';
const diagnostic=JSON.parse(await fs.readFile('research/output/paris-53-storage-diagnostic.json','utf8'));
const today=new Date().toISOString().slice(0,10);
const start=new Date(Date.now()-365*2*86400000).toISOString().slice(0,10);
const rows=[];
for(const row of diagnostic.rows){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),12000);
 try{
  const sourceUrl='https://live.euronext.com/en/ajax/getHistoricalPricePopup/'+encodeURIComponent(row.isin+'-'+euronextProviderMic(row.mic));
  const response=await fetch(sourceUrl,{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest'},body:new URLSearchParams({adjusted:'Y',startdate:start,enddate:today,nbSession:'10'})});
  if(!response.ok)throw Error('HTTP '+response.status);
  const html=decodeEuronextBody(await response.text());
  const parsed=parseEuronextHistoryRows(html);
  const tableRows=[...html.matchAll(/<tr[^>]*>([\\s\\S]*?)<\\/tr>/gi)].slice(0,6).map(x=>[...x[1].matchAll(/<t[dh][^>]*>([\\s\\S]*?)<\\/t[dh]>/gi)].map(y=>y[1].replace(/<[^>]*>/g,' ').replace(/\\s+/g,' ').trim()));
  const header=tableRows.find(r=>r.some(c=>/^date$/i.test(c)))||[];
  const recent=parsed.filter(b=>b.date>=start&&b.date<=today);
  const traded=recent.filter(b=>Number(b.open)>0&&Number(b.close)>0&&Number(b.volume)>0);
  rows.push({isin:row.isin,symbol:row.symbol,mic:row.mic,sourceUrl,headers:header,tableSample:tableRows.slice(0,4),parsedSample:parsed.slice(0,2),returnedRows:parsed.length,recentRows:recent.length,verifiedTrades:traded.length,latestTrade:traded.at(0)?.date||traded.at(-1)?.date||null,classification:traded.length?'VERIFIED_RECENT_TRADES':recent.length?'ROWS_WITHOUT_CONFIRMED_VOLUME':'NO_RECENT_ROWS'});
 }catch(e){rows.push({isin:row.isin,symbol:row.symbol,mic:row.mic,classification:'SOURCE_REQUEST_FAILED',error:String(e.message).slice(0,180)});}
 finally{clearTimeout(timer);}
}
const counts=rows.reduce((a,r)=>(a[r.classification]=(a[r.classification]||0)+1,a),{});
const summary=rows.map(r=>({isin:r.isin,symbol:r.symbol,mic:r.mic,classification:r.classification,verifiedTrades:r.verifiedTrades||0,headers:r.headers||[],parsedSample:r.parsedSample||[],error:r.error||null}));
console.log('PARIS_SOURCE_INSTRUMENT_DETAIL',JSON.stringify(summary));
const output={generatedAt:new Date().toISOString(),start,today,mode:'READ_ONLY_SOURCE_PROBE',counts,rows};
await fs.writeFile('research/output/paris-source-probe.json',JSON.stringify(output,null,2)+'\n');
console.log('PARIS_SOURCE_PROBE',JSON.stringify(counts));
