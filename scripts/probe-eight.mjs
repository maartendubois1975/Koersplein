import {readFile} from 'node:fs/promises';
import {parseRows} from './euronext-parser.mjs';
import {decodeEuronextBody} from './euronext-transport.mjs';
const manifest=JSON.parse(await readFile(new URL('../data/amsterdam-history-manifest.json',import.meta.url)));
const names=['AALB','ABN','AD','ASML','BESI','INGA','PHIA','WKL'];
const date='2026-10-29',results=[];
for(const name of names){
 const item=Object.values(manifest.instruments).find(x=>x.symbol===name);
 if(!item){results.push({symbol:name,status:'NOT_MAPPED'});continue}
 try{
  const response=await fetch('https://live.euronext.com/en/ajax/getHistoricalPricePopup/'+item.isin+'-XAMS',{method:'POST',signal:AbortSignal.timeout(12000),headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest'},body:new URLSearchParams({adjusted:'N',startdate:date,enddate:date,nbSession:'100000'})});
  if(!response.ok){results.push({symbol:name,status:'HTTP_'+response.status});continue}
  const bars=parseRows(decodeEuronextBody(await response.text())).filter(x=>x.date===date);
  const b=bars[0],valid=bars.length===1&&b&&[b.open,b.high,b.low,b.close].every(x=>Number.isFinite(x)&&x>0)&&b.low<=Math.min(b.open,b.close)&&b.high>=Math.max(b.open,b.close)&&Number.isSafeInteger(b.volume)&&b.volume>0;
  results.push({symbol:name,status:valid?'OHLCV_CANDIDATE_UNVERIFIED':'MISSING_OR_INVALID_OHLCV',rows:bars.length});
 }catch(e){results.push({symbol:name,status:'ERROR',reason:e.message})}
}
console.log(JSON.stringify({kind:'EURONEXT_EIGHT_READ_ONLY',date,valid:results.filter(x=>x.status==='OHLCV_CANDIDATE_UNVERIFIED').length,results,published:0}));
