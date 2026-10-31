// Read-only Euronext audit of all 80 mapped Amsterdam stocks; never publishes or writes prices.
import {readFile} from 'node:fs/promises';
import {parseRows} from './euronext-parser.mjs';
import {decodeEuronextBody} from './euronext-transport.mjs';
const manifest=JSON.parse(await readFile(new URL('../data/amsterdam-history-manifest.json',import.meta.url),'utf8'));
const instruments=Object.values(manifest.instruments);
const date=process.argv[2]||'2026-10-29',results=new Array(instruments.length);
if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw Error('INVALID_DATE');
if(instruments.length!==80||new Set(instruments.map(x=>x.isin)).size!==80)throw Error('EXPECTED_80_UNIQUE_INSTRUMENTS');
let next=0;
async function worker(){
 while(next<instruments.length){
  const index=next++,item=instruments[index];
  try{
   const response=await fetch('https://live.euronext.com/en/ajax/getHistoricalPricePopup/'+item.isin+'-XAMS',{method:'POST',signal:AbortSignal.timeout(12000),headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest'},body:new URLSearchParams({adjusted:'N',startdate:date,enddate:date,nbSession:'100000'})});
   if(!response.ok){results[index]={symbol:item.symbol,status:'HTTP_'+response.status};continue}
   const rows=parseRows(decodeEuronextBody(await response.text())).filter(x=>x.date===date);
   const b=rows[0],valid=rows.length===1&&b&&[b.open,b.high,b.low,b.close].every(n=>Number.isFinite(n)&&n>0)&&b.low<=Math.min(b.open,b.close)&&b.high>=Math.max(b.open,b.close)&&Number.isSafeInteger(b.volume)&&b.volume>0;
   const diagnostics=!valid?{missing:!b,invalidPrice:!!b&&![b.open,b.high,b.low,b.close].every(n=>Number.isFinite(n)&&n>0),ohlcRange:!!b&&(b.low>Math.min(b.open,b.close)||b.high<Math.max(b.open,b.close)),invalidVolume:!!b&&(!Number.isSafeInteger(b.volume)||b.volume<=0),zeroVolume:!!b&&b.volume===0}:undefined;
   results[index]={symbol:item.symbol,status:valid?'OHLCV_CANDIDATE_UNVERIFIED':'INVALID_OR_MISSING_OHLCV',rows:rows.length,...(diagnostics?{diagnostics}:{})};
  }catch(e){results[index]={symbol:item.symbol,status:'SOURCE_ERROR',reason:e.message}}
 }
}
await Promise.all(Array.from({length:4},()=>worker()));
const valid=results.filter(x=>x.status==='OHLCV_CANDIDATE_UNVERIFIED').length;
console.log(JSON.stringify({kind:'EURONEXT_EIGHTY_READ_ONLY',date,total:instruments.length,valid,failed:instruments.length-valid,results,published:0}));

if(valid!==instruments.length)process.exitCode=1;
