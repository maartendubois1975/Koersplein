// Read-only evidence from the Malta Stock Exchange's official 2026 price-list archive.
// NEVER returns OHLC or certifies a no-trade day: historical decisions require
// a separately checked instrument, stored last-trade date and exchange policy.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {parseMseOfficialPriceList} from '../history/providers/mse-official-price-list.mjs';

export const MSE_ARCHIVE_URL='https://cdn.borzamalta.com.mt/download/archives/pricelists/Pricelists2026.zip';
const MAX_ZIP=100*1024*1024,MAX_PDF=8*1024*1024,MAX_ENTRIES=300;
const isoDay=d=>typeof d==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;

async function boundedBytes(response,limit){
 if(Number(response.headers?.get?.('content-length'))>limit)throw Error('OFFICIAL_ARCHIVE_TOO_LARGE');
 if(!response.body?.getReader){const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>limit)throw Error('OFFICIAL_ARCHIVE_TOO_LARGE');return bytes;}
 const reader=response.body.getReader(),chunks=[];let total=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>limit)throw Error('OFFICIAL_ARCHIVE_TOO_LARGE');chunks.push(Buffer.from(value));}}
 finally{reader.releaseLock();}
 return Buffer.concat(chunks,total);
}
export function safeArchivePdfNames(listing){
 const entries=String(listing).split(/\r?\n/).filter(Boolean);
 if(entries.length>MAX_ENTRIES)throw Error('OFFICIAL_ARCHIVE_TOO_MANY_ENTRIES');
 // unzip -p never writes to disk, but reject ambiguous paths and archive names.
 if(entries.some(name=>name.startsWith('/')||name.includes('\\')||name.split('/').includes('..')||name.includes('\0')))throw Error('OFFICIAL_ARCHIVE_UNSAFE_ENTRY');
 return entries.filter(name=>/\.pdf$/i.test(name)&&name.length<=240);
}
function priority(name,target){
 const [y,m,d]=target.split('-');const low=name.toLowerCase();
 return [y+m+d,d+m+y.slice(2),d+'-'+m+'-'+y.slice(2),d+'_'+m+'_'+y.slice(2),y+'-'+m+'-'+d].some(v=>low.includes(v))?0:1;
}
export async function probeMseArchive(targetDate,{fetchFn=fetch,extractPdf=null,archiveBytes=null}={}){
 if(!isoDay(targetDate)||!targetDate.startsWith('2026-'))throw Error('INVALID_MSE_ARCHIVE_TARGET_DATE');
 const result={targetDate,sourceUrl:MSE_ARCHIVE_URL,readOnly:true,priceWrites:0,ohlcAvailable:false,status:'UNAVAILABLE',pdfEntries:0,inspected:0,errors:[]};
 let bytes=archiveBytes;
 if(!bytes){
  const response=await fetchFn(MSE_ARCHIVE_URL,{signal:AbortSignal.timeout(45000),headers:{Accept:'application/zip','User-Agent':'Koersplein-official-archive-evidence/1.0'}});
  if(!response.ok)throw Error('MSE archive HTTP '+response.status);
  const url=new URL(response.url||MSE_ARCHIVE_URL);
  if(url.protocol!=='https:'||url.hostname!=='cdn.borzamalta.com.mt'||url.pathname!=='/download/archives/pricelists/Pricelists2026.zip')throw Error('MSE archive redirected outside approved source');
  bytes=await boundedBytes(response,MAX_ZIP);
 }
 bytes=Buffer.from(bytes);
 if(bytes.length<22||bytes.length>MAX_ZIP||bytes.subarray(0,4).toString('hex')!=='504b0304')throw Error('MSE archive is not a bounded ZIP');
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'koersplein-mse-archive-'));
 try{
  const file=path.join(dir,'official.zip');await fs.writeFile(file,bytes);
  const names=safeArchivePdfNames(execFileSync('unzip',['-Z','-1',file],{timeout:15000,maxBuffer:512*1024}).toString('utf8'));
  result.pdfEntries=names.length;
  const ordered=names.sort((a,b)=>priority(a,targetDate)-priority(b,targetDate)||a.localeCompare(b));
  for(const name of ordered){
   result.inspected++;
   try{
    const pdf=execFileSync('unzip',['-p',file,name],{timeout:12000,maxBuffer:MAX_PDF+1024});
    if(pdf.length<100||pdf.length>MAX_PDF||pdf.subarray(0,5).toString()!=='%PDF-')continue;
    const text=extractPdf?extractPdf(pdf,name):execFileSync('pdftotext',['-f','1','-l','1','-layout','-','-'],{input:pdf,timeout:10000,maxBuffer:2*1024*1024}).toString('utf8');
    const snapshot=parseMseOfficialPriceList(text,{expectedDate:targetDate});
    result.status='EXACT_DATE_OFFICIAL_SNAPSHOT_REVIEW_REQUIRED';
    result.archiveEntry=name;
    result.rows=[...snapshot.rows.values()].map(({isin,symbol,lastTradeDate})=>({isin,symbol,lastTradeDate}));
    result.equities=result.rows.length;
    return result;
   }catch(error){
    // An unrelated or malformed PDF is not evidence of trading or no-trading.
    if(result.errors.length<5&&!/date mismatch/.test(String(error.message)))result.errors.push(String(error.message).slice(0,120));
   }
  }
  result.status='NO_EXACT_DATE_OFFICIAL_SNAPSHOT';
  return result;
 }finally{await fs.rm(dir,{recursive:true,force:true});}
}
