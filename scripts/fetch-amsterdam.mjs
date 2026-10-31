import {latestCandidateSession} from './amsterdam-session.mjs';
// Read-only candidate collection. Never marks a quote approved.
import {readFile,writeFile} from 'node:fs/promises';
import {parseRows} from './euronext-parser.mjs';
import {decodeEuronextBody} from './euronext-transport.mjs';
const endpoint='https://live.euronext.com/en/ajax/getHistoricalPricePopup/';
export async function collect(manifest,date,request=fetch){
 const candidates=[],noTrade=[],missing=[],errors=[];
 const instruments=Object.entries(manifest.instruments);
 let next=0;
 async function worker(){
 while(next<instruments.length){
  const [isin,entry]=instruments[next++];
  try{
   const url=endpoint+encodeURIComponent(isin+'-XAMS');
   const response=await request(url,{method:'POST',signal:AbortSignal.timeout(12000),headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest'},body:new URLSearchParams({adjusted:'N',startdate:date,enddate:date,nbSession:'100000'})});
   if(!response.ok)throw Error('HTTP '+response.status);
   const html=await response.text();
   const rows=parseRows(decodeEuronextBody(html));
   const matches=rows.filter(r=>r.date===date);
   if(matches.length>1)throw Error('DUPLICATE_SESSION');
   const found=matches[0];
   if(!found){missing.push({isin,symbol:entry.symbol,date,status:'NO_SOURCE_ROW_LISTING_CHECK_REQUIRED'});continue;}
   if(found.open===null&&found.high===null&&found.low===null&&Number.isFinite(found.close)&&found.close>0&&found.volume===0){noTrade.push({isin,symbol:entry.symbol,date,status:'ZERO_VOLUME_REFERENCE_UNVERIFIED',referenceClose:found.close});continue;}
   if(![found.open,found.high,found.low,found.close].every(n=>Number.isFinite(n)&&n>0)||found.low>Math.min(found.open,found.close)||found.high<Math.max(found.open,found.close)||!Number.isSafeInteger(found.volume)||found.volume<=0)throw Error('INVALID_OHLCV_OR_ZERO_VOLUME');
   candidates.push({...found,isin,symbol:entry.symbol,mic:'XAMS',source:'Euronext public historical table',retrievedAt:new Date().toISOString(),sourceUrl:url,sourceVerified:false,sessionClosedVerified:false});
  }catch(error){errors.push({isin,error:error.message})}
 }
 }
 await Promise.all(Array.from({length:Math.min(4,instruments.length)},()=>worker()));
 for(const group of [candidates,noTrade,missing,errors])group.sort((a,b)=>a.isin.localeCompare(b.isin));
 return {market:'XAMS',date,candidates,noTrade,missing,errors,approved:0};
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 const [requestedDate,out]=process.argv.slice(2);
 const date=requestedDate==='auto'?latestCandidateSession():requestedDate;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!out)throw Error('Usage: node scripts/fetch-amsterdam.mjs YYYY-MM-DD output.json');
 const manifest=JSON.parse(await readFile(new URL('../data/amsterdam-history-manifest.json',import.meta.url),'utf8'));
 const result=await collect(manifest,date);
 await writeFile(out,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({candidates:result.candidates.length,noTrade:result.noTrade.length,missing:result.missing.length,errors:result.errors.length,approved:0}));
}
