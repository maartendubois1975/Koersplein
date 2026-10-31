import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {manifestResolver} from '../market-week-core.mjs';
import {validateHistoryDocument} from '../chart.js';
const root=new URL('../',import.meta.url);
const read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const catalog=(await read('data/euronext-amsterdam.json')).shares;
const manifest=await read('data/amsterdam-history-manifest.json');
assert.equal(catalog.length,85);
const ids=Object.keys(manifest.instruments);
assert.equal(ids.length,80);
const resolve=manifestResolver(manifest,'XAMS');
let total=0,latest=null;
for(const id of ids){
 const listing=catalog.find(x=>x.isin===id&&x.symbol===manifest.instruments[id].symbol);
 assert.ok(listing,'Catalog identity missing: '+id);
 assert.equal(resolve(listing),id);
 const h=await read('data/history/'+id+'.json');
 assert.equal(h.instrument.isin,id);
 assert.equal(h.instrument.mic,'XAMS');
 assert.equal(h.instrument.symbol,listing.symbol);
 const bars=validateHistoryDocument(h,{...listing,isin:id,mic:'XAMS',symbol:listing.symbol});
 assert.ok(bars.length>0,'No history: '+id);
 total+=bars.length;
 const last=bars.at(-1).date;
 if(!latest||last>latest)latest=last;
}
for(const file of ['index.html','amsterdam.html','amsterdam-week.js','share.html','share.js','chart.js']){
 const body=await readFile(new URL(file,root),'utf8');
 assert.ok(body.length>100,'Missing frontend '+file);
}
console.log(JSON.stringify({status:'PASS',catalog:catalog.length,mapped:ids.length,historicalRecords:total,lastObservedDate:latest,scope:'STRUCTURAL_ONLY_NOT_LIVE_VERIFIED'}));
