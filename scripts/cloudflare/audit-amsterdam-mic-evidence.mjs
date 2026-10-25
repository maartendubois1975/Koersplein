// Read-only Euronext segment identity audit for the canonical Amsterdam 124.
// The combined directory includes TNLA, XAMC and XAMS; its blanket mic:XAMS
// is NOT individual listing proof. Current directory != historical listing status.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const SEGMENTS=['XAMS','TNLA','XAMC'];
const ROOT='https://live.euronext.com/en/product_directory/data/stocks-amsterdam/download';
const identity=(isin,ticker)=>String(isin||'').trim().toUpperCase()+'\u0000'+String(ticker||'').trim().toUpperCase();
export function parseDirectoryCsv(csv){
 const lines=String(csv||'').replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean);
 const fields=line=>{const out=[];let value='',quoted=false;for(let i=0;i<line.length;i++){
  const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}
  else if(c===';'&&!quoted){out.push(value);value='';}else value+=c;
 }if(quoted)throw Error('UNTERMINATED_CSV_QUOTE');out.push(value);return out;};
 const headerIndex=lines.findIndex(line=>/^Name;/i.test(line));
 if(headerIndex<0)throw Error('OFFICIAL_DIRECTORY_HEADER_MISSING');
 const headers=fields(lines[headerIndex]).map(x=>x.trim().toLowerCase());
 const col=(...names)=>headers.findIndex(x=>names.includes(x));
 const ni=col('name'),ii=col('isin'),ti=col('symbol','ticker'),mi=col('market');
 if([ni,ii,ti].some(x=>x<0))throw Error('OFFICIAL_DIRECTORY_IDENTITY_COLUMNS_MISSING');
 const rows=lines.slice(headerIndex+1).map(fields).filter(x=>x.length>=headers.length).map(x=>({name:x[ni],isin:x[ii],symbol:x[ti],market:mi>=0?x[mi]:null}));
 return rows.filter(x=>/^[A-Z]{2}[A-Z0-9]{10}$/.test(String(x.isin||'').toUpperCase())&&String(x.symbol||'').trim());
}
export function classifyDirectoryListings(catalog,segments){
 const indexed=Object.fromEntries(SEGMENTS.map(mic=>[mic,new Map((segments[mic]||[]).map(row=>[identity(row.isin,row.symbol),row]))]));
 const byIsin=Object.fromEntries(SEGMENTS.map(mic=>[mic,new Map()]));
 for(const mic of SEGMENTS)for(const row of segments[mic]||[]){
  const isin=String(row.isin).toUpperCase();
  if(!byIsin[mic].has(isin))byIsin[mic].set(isin,new Set());
  byIsin[mic].get(isin).add(String(row.symbol).toUpperCase());
 }
 return catalog.map(share=>{
  const exact=SEGMENTS.filter(mic=>indexed[mic].has(identity(share.isin,share.symbol)));
  const isinOnly=SEGMENTS.filter(mic=>byIsin[mic].has(String(share.isin).toUpperCase())&&!exact.includes(mic));
  const classification=exact.includes('XAMS')?(exact.length===1?'XAMS_EXACT':'XAMS_AND_OTHER_SEGMENT'):
   exact.length?'OTHER_SEGMENT_EXACT_ONLY':isinOnly.includes('XAMS')?'XAMS_ISIN_TICKER_MISMATCH':
   isinOnly.length?'OTHER_SEGMENT_ISIN_ONLY':'NO_OFFICIAL_SEGMENT_MATCH';
  return {isin:share.isin,ticker:share.symbol,classification,exactSegments:exact,isinOnlySegments:isinOnly,
   xamsOtherTickers:[...(byIsin.XAMS.get(String(share.isin).toUpperCase())||[])]};
 });
}
async function fetchOfficialSegment(mic,fetchImpl=globalThis.fetch){
 const url=ROOT+'?'+new URLSearchParams({mics:mic});let last;
 for(let attempt=0;attempt<2;attempt++){
  try{
   const r=await fetchImpl(url,{signal:AbortSignal.timeout(20000),headers:{Accept:'text/csv,text/plain,*/*'}});
   if(!r.ok){last=Error('OFFICIAL_DIRECTORY_HTTP_'+r.status);if(r.status!==429&&r.status<500)break;continue;}
   return {url,rows:parseDirectoryCsv(await r.text())};
  }catch(e){last=e;}
 }
 throw last||Error('OFFICIAL_DIRECTORY_UNAVAILABLE');
}
async function run(){
 const catalog=JSON.parse(await fs.readFile('data/euronext-amsterdam.json','utf8'));
 assert.equal(catalog.shares?.length,124,'CANONICAL_XAMS_CATALOG_NOT_124');
 const segments={},sources={},errors={};
 for(const mic of SEGMENTS){
  try{const data=await fetchOfficialSegment(mic);segments[mic]=data.rows;sources[mic]={url:data.url,count:data.rows.length};}
  catch(e){errors[mic]=String(e?.message||e).slice(0,180);}
 }
 const complete=Object.keys(sources).length===SEGMENTS.length;
 // Partial downloads must NEVER be interpreted as negative MIC evidence.
 const listings=complete?classifyDirectoryListings(catalog.shares,segments):[];
 const counts={};for(const row of listings)counts[row.classification]=(counts[row.classification]||0)+1;
 const report={generatedAt:new Date().toISOString(),commit:process.env.GITHUB_SHA||null,
  scope:'READ_ONLY_CURRENT_SEGMENT_DIRECTORY_NOT_HISTORICAL_SESSION_PROOF',
  canonicalCatalog:124,referenceWeek:['2026-10-19','2026-10-20','2026-10-21','2026-10-22','2026-10-23'],
  segmentSources:sources,sourceErrors:errors,completeSourceSnapshot:complete,counts,listings,
  unmatchedStorageFocus:listings.filter(r=>['AED','AF','ENX','ONWD','PPLAA','PPLAB','PPLA','RET','VASTB','WDP'].includes(r.ticker)),
  warnings:[
   'Only an exact MIC + ISIN + ticker match supports a current segment identity; ISIN alone never does.',
   'The official directory is a CURRENT snapshot and cannot establish active listings on 2026-10-19..23.',
   'If any segment source fails, all segment classifications are withheld (fail closed).',
   'No OHLCV, NO_TRADES or historic listings are written or inferred from this directory.',
   'The public directory is discovery evidence, not proof of price redistribution rights.'
  ]};
 await fs.mkdir('research/output/audit',{recursive:true});
 await fs.writeFile('research/output/audit/amsterdam-official-mic-evidence.json',JSON.stringify(report,null,2)+'\n');
 console.log('XAMS_OFFICIAL_MIC_EVIDENCE '+JSON.stringify({completeSourceSnapshot:complete,segmentSources:sources,sourceErrors:errors,counts,unmatchedStorageFocus:report.unmatchedStorageFocus}));
}
function selfTest(){
 const csv='Metadata;irrelevant\nName;ISIN;Symbol;Market\n"Company; Name";NL0000000001;AAA;Amsterdam\n"Quoted ""Name""";NL0000000002;BBB;Amsterdam\n';
 const parsed=parseDirectoryCsv(csv);assert.equal(parsed.length,2);assert.equal(parsed[0].name,'Company; Name');assert.equal(parsed[1].name,'Quoted "Name"');
 const catalog=[{isin:'NL0000000001',symbol:'AAA'},{isin:'NL0000000002',symbol:'BBB'},{isin:'NL0000000003',symbol:'CCC'},{isin:'NL0000000004',symbol:'DDD'}];
 const r=classifyDirectoryListings(catalog,{
  XAMS:[{isin:'NL0000000001',symbol:'AAA'},{isin:'NL0000000002',symbol:'OLD'},{isin:'NL0000000004',symbol:'DDD'}],
  TNLA:[{isin:'NL0000000004',symbol:'DDD'},{isin:'NL0000000003',symbol:'CCC'}],XAMC:[]});
 assert.deepEqual(r.map(x=>x.classification),['XAMS_EXACT','XAMS_ISIN_TICKER_MISMATCH','OTHER_SEGMENT_EXACT_ONLY','XAMS_AND_OTHER_SEGMENT']);
 assert.deepEqual(r[1].xamsOtherTickers,['OLD']);
 console.log('XAMS segment evidence: CSV quoting, exact MIC/ISIN/ticker, ambiguous and mismatch fail-closed PASS');
}
if(process.argv.includes('--self-test'))selfTest();
else if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)await run();
