// Read-only end-to-end smoke test of the DEPLOYED Amsterdam page, not a local mock of market data.
// Runs the exact deployed (SHA-matched) browser module with a minimal DOM and real public Worker fetches.
// Does not write history, trigger imports or infer NO_TRADES from missing candles.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {AMSTERDAM_REFERENCE_WEEK,verifiedNoTradeStatus,collectMarketWeek,sessionChange} from '../../market-week-core.mjs';

const site=String(process.env.KOERSPLEIN_SITE_URL||'https://koersplein.onrender.com').replace(/\/$/,'');
const sha=text=>createHash('sha256').update(text).digest('hex');
const originalFetch=globalThis.fetch;
const get=async url=>{
 const response=await originalFetch(url,{cache:'no-store',signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error('PUBLIC_HTTP_'+response.status+' '+url);
 return response.text();
};
const pageUrl=site+'/amsterdam.html';
let html,js,core,statusText,catalogText;
for(let attempt=1;attempt<=12;attempt++){
 try{
  html=await get(pageUrl+'?audit='+Date.now());
  const script=html.match(/src=["'](amsterdam-week\.js\?v=[^"']+)["']/)?.[1];
  assert.ok(script,'PUBLIC_AMSTERDAM_SCRIPT_NOT_VERSIONED');
  js=await get(site+'/'+script);
  const corePath=js.match(/from\s+["']\.\/(market-week-core\.mjs\?v=[^"']+)["']/)?.[1];
  assert.ok(corePath,'PUBLIC_CORE_IMPORT_NOT_VERSIONED');
  core=await get(site+'/'+corePath);
  statusText=await get(site+'/data/amsterdam-no-trades-2026-10-19-23.json');
  catalogText=await get(site+'/data/euronext-amsterdam.json');
  for(const [name,remote] of [
   ['amsterdam-week.js',js],['market-week-core.mjs',core],
   ['data/amsterdam-no-trades-2026-10-19-23.json',statusText],
   ['data/euronext-amsterdam.json',catalogText]
  ]){
   const local=await fs.readFile(name,'utf8');
   assert.equal(sha(remote),sha(local),'PUBLIC_ASSET_NOT_CURRENT '+name);
  }
  break;
 }catch(error){
  if(attempt===12)throw Error('PUBLIC_DEPLOY_PARITY_FAILED: '+error.message);
  await delay(10000);
 }
}
const catalog=JSON.parse(catalogText),audit=JSON.parse(statusText);
assert.equal(catalog.shares?.length,124,'XAMS_CANONICAL_CATALOG_NOT_124');
assert.deepEqual(audit.week,AMSTERDAM_REFERENCE_WEEK);
let auditedNoTrade=0;
for(const [isin,dates] of Object.entries(audit.noTrades||{})){
 const share=catalog.shares.find(x=>x.isin===isin);
 assert.ok(share,'STATUS_NOT_IN_CATALOG '+isin);
 for(const date of dates){
  assert.ok(verifiedNoTradeStatus(audit,share,'XAMS',date,AMSTERDAM_REFERENCE_WEEK),'UNVERIFIED_NO_TRADE '+isin+' '+date);
  auditedNoTrade++;
 }
}
assert.equal(auditedNoTrade,66,'XAMS_OFFICIAL_STATUS_BASELINE_CHANGED');
const config=html.match(/window\.KOERSPLEIN_MARKET\s*=\s*(\{[^<]+?\})\s*<\/script>/)?.[1];
assert.ok(config,'PUBLIC_XAMS_CONFIG_MISSING');
const market=JSON.parse(config);
assert.equal(market.mic,'XAMS');
const target={innerHTML:'',textContent:''},count={textContent:''},search={value:'',addEventListener(){}};
globalThis.window={KOERSPLEIN_MARKET:market};
globalThis.document={getElementById:id=>({'week-prices-table':target,'share-count':count,search}[id]||null)};
// Capture exactly the public Worker responses consumed by the rendered page.
// Replay these in the independent coverage assertion: no second 124-instrument API sweep.
const apiBase=String(market.api||'https://koersplein.maarten-dubois1975.workers.dev').replace(/\/$/,'');
let capturedManifest=null;
const capturedHistory=new Map();
globalThis.fetch=async(url,opts)=>{
 const absolute=new URL(String(url),site+'/').href;
 const response=await originalFetch(absolute,opts);
 if(absolute===apiBase+'/api/history/manifest.json'&&response.ok)
  capturedManifest=await response.clone().json();
 else if(absolute.startsWith(apiBase+'/api/history/')&&!absolute.endsWith('/manifest.json'))
  capturedHistory.set(absolute,{ok:response.ok,status:response.status,data:response.ok?await response.clone().json():null});
 return response;
};
try{
 // Asset hashes above prove that this local executable is byte-for-byte the deployed module.
 await import(pathToFileURL(path.resolve('amsterdam-week.js')).href+'?public-page-audit='+Date.now());
 for(let i=0;i<450&&!target.innerHTML.includes('<table>');i++){
  if(target.textContent.startsWith('Amsterdamse weekkoersen niet beschikbaar:'))throw Error(target.textContent);
  await delay(300);
 }
 const rendered=target.innerHTML;
 assert.ok(rendered.includes('<table>'),'PUBLIC_RENDER_TIMEOUT_OR_EMPTY');
 assert.equal(Number(count.textContent),124,'PUBLIC_CATALOG_COUNT_MISMATCH');
 const totals=rendered.match(/(\d+) geldige koersdagen · (\d+) dagen zonder handel · (\d+) nog niet verklaard/);
 assert.ok(totals,'PUBLIC_COVERAGE_SUMMARY_MISSING');
 const [valid,noTrade,unresolved]=totals.slice(1).map(Number);
 assert.equal(valid+noTrade+unresolved,620,'PUBLIC_COVERAGE_NOT_PARTITIONED');
 assert.ok(capturedManifest,'PUBLIC_MANIFEST_NOT_CAPTURED');
 assert.ok(capturedHistory.size>0,'PUBLIC_HISTORY_NOT_CAPTURED');
 const replay=async url=>{
  const item=capturedHistory.get(url);
  assert.ok(item,'PUBLIC_HISTORY_REQUEST_NOT_CAPTURED '+url);
  return {ok:item.ok,status:item.status,json:async()=>item.data};
 };
 const measured=await collectMarketWeek({catalog:catalog.shares,manifest:capturedManifest,apiBase,mic:'XAMS',
  dates:AMSTERDAM_REFERENCE_WEEK,fetchImpl:replay,concurrency:8});
 const expectedNoTrade=date=>measured.rows.filter(row=>!row.bars.has(date)&&
  verifiedNoTradeStatus(audit,row.share,'XAMS',date,AMSTERDAM_REFERENCE_WEEK)).length;
 const perDay=Object.fromEntries(AMSTERDAM_REFERENCE_WEEK.map(date=>{
  const traded=measured.coverage.perDay[date].valid,notTraded=expectedNoTrade(date);
  return [date,{traded,noTrade:notTraded,unresolved:124-traded-notTraded}];
 }));
 const expectedValid=measured.coverage.validSessions;
 const expectedNoTradeTotal=Object.values(perDay).reduce((sum,day)=>sum+day.noTrade,0);
 assert.equal(valid,expectedValid,'PUBLIC_OHLC_DIFFERS_FROM_WORKER');
 assert.equal(noTrade,expectedNoTradeTotal,'PUBLIC_NO_TRADES_DIFFERS_FROM_AUDIT');
 assert.equal(unresolved,620-expectedValid-expectedNoTradeTotal,'PUBLIC_MISSING_DIFFERS_FROM_WORKER');
 assert.ok(valid>=507,'PUBLIC_VALID_OHLC_REGRESSION');
 assert.ok(noTrade<=auditedNoTrade,'PUBLIC_NO_TRADE_NOT_AUDITED');
 const body=rendered.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1];
 assert.ok(body,'PUBLIC_TABLE_BODY_MISSING');
 assert.equal((body.match(/<tr>/g)||[]).length,124,'PUBLIC_NOT_ALL_CATALOG_ROWS');
 for(const date of AMSTERDAM_REFERENCE_WEEK){
  assert.ok(rendered.includes(date+' (XAMS)'),'PUBLIC_DAY_MISSING '+date);
  const d=perDay[date];
  assert.ok(rendered.includes(date.slice(8)+' okt: '+d.traded+' koers · '+d.noTrade+' geen handel · '+d.unresolved+' open'),
   'PUBLIC_DAY_COUNTS_DIFFER_FROM_WORKER '+date);
 }
 const money=(value,currency)=>new Intl.NumberFormat('nl-NL',{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:4}).format(value);
 const signed=value=>new Intl.NumberFormat('nl-NL',{signDisplay:'always',minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
 const samples=[['AALB','2026-10-19'],['ABN','2026-10-23'],['ASML','2026-10-23']];
 const verifiedSamples=[];
 for(const [ticker,date] of samples){
  const row=measured.rows.find(item=>item.share.symbol===ticker);
  assert.ok(row,'PUBLIC_SAMPLE_LISTING_MISSING '+ticker);
  const bar=row.bars.get(date);
  assert.ok(bar,'PUBLIC_SAMPLE_OHLC_MISSING '+ticker+' '+date);
  const htmlRow=body.split('</tr>').find(item=>item.includes('>'+ticker+' · '));
  assert.ok(htmlRow,'PUBLIC_SAMPLE_ROW_MISSING '+ticker);
  const currency=row.currency||'EUR',delta=sessionChange(bar.open,bar.close);
  assert.ok(htmlRow.includes(money(bar.open,currency)),'PUBLIC_SAMPLE_OPEN_DIFFERS '+ticker);
  assert.ok(htmlRow.includes(money(bar.close,currency)),'PUBLIC_SAMPLE_CLOSE_DIFFERS '+ticker);
  assert.ok(htmlRow.includes(signed(delta.absolute)+' '+currency+' / '+signed(delta.percent)+'%'),
   'PUBLIC_SAMPLE_CHANGE_DIFFERS '+ticker);
  verifiedSamples.push({ticker,date,open:bar.open,close:bar.close,volume:bar.volume,percent:delta.percent});
 }
 assert.ok(rendered.includes('Dag ± = slot minus opening'),'PUBLIC_DELTA_DEFINITION_MISSING');
 console.log('XAMS_PUBLIC_PAGE_E2E '+JSON.stringify({site,cutoff:AMSTERDAM_REFERENCE_WEEK.at(-1),catalog:124,
  valid,noTrade,unresolved,perDay,verifiedSamples,staticAssets:'SHA256_MATCH',renderedRows:124,
  worker:'PUBLIC_LIVE',apiFrontendParity:'EXACT_PER_DAY_AND_SAMPLES',noHistoryWrites:true}));
}finally{
 globalThis.fetch=originalFetch;
 delete globalThis.document;
 delete globalThis.window;
}
