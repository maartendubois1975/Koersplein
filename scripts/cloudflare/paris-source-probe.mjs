import fs from 'node:fs/promises';
import {euronextDailySnapshot} from '../history/providers/euronext-live.mjs';
const diagnostic=JSON.parse(await fs.readFile('research/output/paris-53-storage-diagnostic.json','utf8'));
const today=new Date().toISOString().slice(0,10);
const start=new Date(Date.now()-365*2*86400000).toISOString().slice(0,10);
const rows=[];
for(const row of diagnostic.rows){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),12000);
 try{
  const result=await euronextDailySnapshot(row,today,controller.signal);
  const recent=result.rows.filter(b=>b.date>=start&&b.date<=today);
  const traded=recent.filter(b=>Number(b.open)>0&&Number(b.close)>0&&Number(b.volume)>0);
  rows.push({isin:row.isin,symbol:row.symbol,mic:row.mic,sourceUrl:result.sourceUrl,returnedRows:result.rows.length,recentRows:recent.length,verifiedTrades:traded.length,latestTrade:traded.at(0)?.date||traded.at(-1)?.date||null,classification:traded.length?'VERIFIED_RECENT_TRADES':recent.length?'ROWS_WITHOUT_CONFIRMED_VOLUME':'NO_RECENT_ROWS'});
 }catch(e){rows.push({isin:row.isin,symbol:row.symbol,mic:row.mic,classification:'SOURCE_REQUEST_FAILED',error:String(e.message).slice(0,180)});}
 finally{clearTimeout(timer);}
}
const counts=rows.reduce((a,r)=>(a[r.classification]=(a[r.classification]||0)+1,a),{});
const output={generatedAt:new Date().toISOString(),start,today,mode:'READ_ONLY_SOURCE_PROBE',counts,rows};
await fs.writeFile('research/output/paris-source-probe.json',JSON.stringify(output,null,2)+'\n');
console.log('PARIS_SOURCE_PROBE',JSON.stringify(counts));
