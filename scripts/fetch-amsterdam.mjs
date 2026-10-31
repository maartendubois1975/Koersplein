// Read-only candidate collection. Never marks a quote approved.
import {readFile,writeFile} from 'node:fs/promises';
import {parseRows} from './euronext-parser.mjs';
const endpoint='https://live.euronext.com/en/ajax/getHistoricalPricePopup/';
export async function collect(manifest,date,request=fetch){
 const candidates=[],errors=[];
 for(const [isin,entry] of Object.entries(manifest.instruments)){
  try{
   const url=endpoint+encodeURIComponent(isin+'-XAMS');
   const response=await request(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest'},body:new URLSearchParams({adjusted:'N',startdate:date,enddate:date,nbSession:'100000'})});
   if(!response.ok)throw Error('HTTP '+response.status);
   const html=await response.text();
   if(html.trim().startsWith('{'))throw Error('ENCODED_RESPONSE_NOT_SUPPORTED');
   const rows=parseRows(html);
   const found=rows.find(r=>r.date===date.split('-').reverse().join('/'));
   if(!found)throw Error('NO_VERIFIED_TRADE');
   candidates.push({...found,isin,symbol:entry.symbol,mic:'XAMS',sourceUrl:url,sourceVerified:false,sessionClosedVerified:false});
  }catch(error){errors.push({isin,error:error.message})}
 }
 return {market:'XAMS',date,candidates,errors,approved:0};
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 const [date,out]=process.argv.slice(2);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!out)throw Error('Usage: node scripts/fetch-amsterdam.mjs YYYY-MM-DD output.json');
 const manifest=JSON.parse(await readFile(new URL('../data/amsterdam-history-manifest.json',import.meta.url),'utf8'));
 const result=await collect(manifest,date);
 await writeFile(out,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({candidates:result.candidates.length,errors:result.errors.length,approved:0}));
}
