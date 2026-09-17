import { mkdir, writeFile } from 'node:fs/promises';
import { FactoryApiClient } from '../cloudflare/client.mjs';
import { cloudflareCatalog } from '../cloudflare/catalog.mjs';
import { scanPlus30Chain, summarizePlus30Chains } from './plus30-chain-scanner.mjs';

const client = new FactoryApiClient();
const catalog = await cloudflareCatalog();
const instruments = catalog.instruments.filter(x => x.mic === 'XAMS');

function extractBars(history) {
  const candidates = [history?.bars, history?.history, history?.records, history?.data];
  for (const a of candidates) if (Array.isArray(a) && a.length && a.some(x => x?.date && Number.isFinite(Number(x?.close)))) return a;
  // Worker history may return yearly partitions/series: recursively collect date/close rows.
  const out=[]; const seen=new Set();
  function walk(v){
    if(!v || typeof v!=='object') return;
    if(Array.isArray(v)){ for(const x of v) walk(x); return; }
    if(v.date && Number.isFinite(Number(v.close))){ const k=String(v.date).slice(0,10); if(!seen.has(k)){seen.add(k);out.push(v);} return; }
    for(const x of Object.values(v)) walk(x);
  }
  walk(history);
  return out;
}

const results=[]; const failures=[];
for (const item of instruments) {
  try {
    const h=await client.history(item.isin);
    const bars=extractBars(h);
    if(bars.length<2) throw new Error(`slechts ${bars.length} koerspunten`);
    const scan=scanPlus30Chain(bars);
    results.push({isin:item.isin,ticker:item.ticker,company:item.company,points:bars.length,...scan});
  } catch(e) { failures.push({isin:item.isin,ticker:item.ticker,company:item.company,error:e.message}); }
}

const summary=summarizePlus30Chains(results,90);
const fastHits=results.flatMap(r=>(r.hits||[]).filter(h=>h.calendarDays<=90).map(h=>({isin:r.isin,ticker:r.ticker,company:r.company,...h})));
const byStock=[...new Map(results.map(r=>[r.isin,{isin:r.isin,ticker:r.ticker,company:r.company,fast:(r.hits||[]).filter(h=>h.calendarDays<=90).length,total:(r.hits||[]).length}])).values()].sort((a,b)=>b.fast-a.fast||b.total-a.total);
const examples=[...fastHits].sort((a,b)=>a.calendarDays-b.calendarDays).slice(0,25);
const payload={generatedAt:new Date().toISOString(),definition:'eerste koers=nulpunt; eerste close >= nulpunt*1.30 is hit; daadwerkelijke hit-close wordt direct nieuw nulpunt',instruments:instruments.length,processed:results.length,failures,summary,byStock:byStock.slice(0,25),fastestExamples:examples};
await mkdir('research/output/plus30-chain',{recursive:true});
await writeFile('research/output/plus30-chain/summary.json',JSON.stringify(payload,null,2));
await writeFile('research/output/plus30-chain/all-results.json',JSON.stringify(results));
console.log(JSON.stringify(payload,null,2));
if(failures.length) process.exitCode=2;
