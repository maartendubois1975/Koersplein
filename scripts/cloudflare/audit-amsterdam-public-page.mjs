// Read-only end-to-end smoke test of the DEPLOYED Amsterdam page, not a local mock of market data.
// Runs the exact deployed (SHA-matched) browser module with a minimal DOM and real public Worker fetches.
// Does not write history, trigger imports or infer NO_TRADES from missing candles.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {AMSTERDAM_REFERENCE_WEEK,verifiedNoTradeStatus} from '../../market-week-core.mjs';

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
globalThis.fetch=(url,opts)=>originalFetch(new URL(String(url),site+'/').href,opts);
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
 assert.ok(valid>=507,'PUBLIC_VALID_OHLC_REGRESSION');
 assert.ok(noTrade<=auditedNoTrade,'PUBLIC_NO_TRADE_NOT_AUDITED');
 const body=rendered.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1];
 assert.ok(body,'PUBLIC_TABLE_BODY_MISSING');
 assert.equal((body.match(/<tr>/g)||[]).length,124,'PUBLIC_NOT_ALL_CATALOG_ROWS');
 for(const date of AMSTERDAM_REFERENCE_WEEK){
  assert.ok(rendered.includes(date+' (XAMS)'),'PUBLIC_DAY_MISSING '+date);
  assert.match(rendered,new RegExp(date.slice(8)+' okt: \\d+ koers · \\d+ geen handel · \\d+ open'),'PUBLIC_DAY_COUNTS_MISSING '+date);
 }
 for(const ticker of ['AALB','ABN','ASML'])assert.ok(rendered.includes('>'+ticker+' · '),'PUBLIC_EXAMPLE_MISSING '+ticker);
 assert.ok(rendered.includes('Dag ± = slot minus opening'),'PUBLIC_DELTA_DEFINITION_MISSING');
 console.log('XAMS_PUBLIC_PAGE_E2E '+JSON.stringify({site,cutoff:AMSTERDAM_REFERENCE_WEEK.at(-1),catalog:124,valid,noTrade,unresolved,staticAssets:'SHA256_MATCH',renderedRows:124,worker:'PUBLIC_LIVE',noHistoryWrites:true}));
}finally{
 globalThis.fetch=originalFetch;
 delete globalThis.document;
 delete globalThis.window;
}
