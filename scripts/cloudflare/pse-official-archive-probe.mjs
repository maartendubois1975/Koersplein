// Read-only official PSE archive probe: never imports, classifies NO_TRADES or writes production prices.
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,readFile,rm,writeFile,mkdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const run=promisify(execFile);
const targetIsins=['CS0008419750','CZ0009011474','CS0008416251','CZ0005088559','CZ0009009718','CZ1008000823','CZ0009011714'];
const dates=['2026-10-23','2026-10-22','2026-10-21'];
const results=[];
const sha256=b=>createHash('sha256').update(b).digest('hex');
for(const date of dates){
 const stamp=date.slice(2).replaceAll('-','');
 const url='https://ftp.pse.cz/Results.ak/pl'+stamp+'.zip';
 const result={date,url,status:'NOT_CHECKED',archiveSha256:null,entryNames:[],matchedIsins:[],missingIsins:targetIsins,readOnly:true};
 const dir=await mkdtemp(path.join(os.tmpdir(),'koersplein-pse-'));
 try{
  const response=await fetch(url,{signal:AbortSignal.timeout(18000),headers:{Accept:'*/*','User-Agent':'Mozilla/5.0 (compatible; KoerspleinSourceResearch/1.0)'}});
  result.httpStatus=response.status;result.contentType=response.headers.get('content-type');result.server=response.headers.get('server');
  if(!response.ok){result.status='HTTP_'+response.status;continue;}
  const archive=Buffer.from(await response.arrayBuffer());
  if(archive.length<100||archive[0]!==0x50||archive[1]!==0x4b){result.status='NOT_ZIP';continue;}
  result.archiveSha256=sha256(archive);
  result.archiveBytes=archive.length;
  const zipPath=path.join(dir,'price-list.zip');
  await writeFile(zipPath,archive);
  const listing=(await run('unzip',['-Z','-1',zipPath],{timeout:10000,maxBuffer:1024*1024})).stdout.trim().split(/\r?\n/);
  result.entryNames=listing;
  const entry=listing.find(x=>new RegExp('(?:^|/)AK'+stamp+'\\.CSV$','i').test(x))||listing.find(x=>/(?:^|\/)AK[^/]*\.CSV$/i.test(x));
  if(!entry){result.status='AK_ENTRY_MISSING';continue;}
  const raw=(await run('unzip',['-p',zipPath,entry],{timeout:10000,encoding:'buffer',maxBuffer:8*1024*1024})).stdout;
  const csv=new TextDecoder('windows-1250').decode(raw);
  const lines=csv.split(/\r?\n/).filter(Boolean);
  result.csvLineCount=lines.length;
  result.csvSha256=sha256(raw);
  result.separatorCounts={semicolon:(lines[0]?.match(/;/g)||[]).length,comma:(lines[0]?.match(/,/g)||[]).length,tab:(lines[0]?.match(/\t/g)||[]).length};
  result.matchedIsins=targetIsins.filter(isin=>lines.some(line=>line.includes(isin)));
  result.missingIsins=targetIsins.filter(isin=>!result.matchedIsins.includes(isin));
  result.status='AK_IDENTITIES_PROBED';
 }catch(error){result.status='TRANSPORT_OR_ARCHIVE_ERROR';result.error=String(error?.message||error).slice(0,240);}
 finally{await rm(dir,{recursive:true,force:true});results.push(result);}
}
await mkdir('research/output',{recursive:true});
const output={generatedAt:new Date().toISOString(),mode:'READ_ONLY_PSE_ARCHIVE_PROBE',targetCutoff:'2026-10-23',targetIsins,results,warning:'Metadata only; no prices, no trading classifications, no license grant. Confirm official ISIN/MIC/currency, date-specific OHLC, trades and current commercial redistribution rights before any production adapter.'};
await writeFile('research/output/pse-official-archive-probe.json',JSON.stringify(output,null,2)+'\n');
console.log('PSE_OFFICIAL_ARCHIVE_PROBE',JSON.stringify(results.map(r=>({date:r.date,status:r.status,httpStatus:r.httpStatus,matched:r.matchedIsins.length,missing:r.missingIsins.length}))));
