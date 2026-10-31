// Network-only diagnostic. Never writes market data or changes the website.
import {parseRows} from './euronext-parser.mjs';
import {decodeEuronextBody} from './euronext-transport.mjs';
const isin=process.env.PROBE_ISIN||'NL0000852564',date='2026-10-29';
const url='https://live.euronext.com/en/ajax/getHistoricalPricePopup/'+isin+'-XAMS';
let result={kind:'EURONEXT_READ_ONLY_PROBE',isin,date,status:'UNKNOWN'};
try{
 const response=await fetch(url,{method:'POST',signal:AbortSignal.timeout(12000),headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest'},body:new URLSearchParams({adjusted:'N',startdate:date,enddate:date,nbSession:'100000'})});
 const body=await response.text();
 result.httpStatus=response.status;
 result.contentType=response.headers.get('content-type')||'unknown';
 result.bytes=body.length;
 if(!response.ok)result.status='HTTP_REJECTED';
 else if(/^\s*[{[]/.test(body)){
  try{const rows=parseRows(decodeEuronextBody(body));result.rows=rows.length;result.hasTargetDate=rows.some(x=>x.date===date);result.status='JSON_TRANSPORT_DECODED_UNVERIFIED'}
  catch(e){result.status='JSON_DECODE_OR_PARSE_FAILED';result.reason=e.message}
 }
 else if(!/<tr[\s>]/i.test(body))result.status='NO_HTML_TABLE';
 else{
  try{
   const bars=parseRows(body);
   result.rows=bars.length;
   result.hasTargetDate=bars.some(x=>x.date===date);
   result.status='HTML_TABLE_PARSED_UNVERIFIED';
  }catch(e){result.status='TABLE_PARSE_FAILED';result.reason=e.message}
 }
}catch(e){result.status='NETWORK_OR_TIMEOUT_ERROR';result.reason=e.name||'unknown'}
console.log(JSON.stringify(result));
// This diagnostic must never block a static site build.
