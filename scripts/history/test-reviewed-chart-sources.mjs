import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {mergeChartHistoryBars} from '../../chart.js';
const manifest=JSON.parse(await fs.readFile('data/history-chart-resolutions.json'));
const evidence=JSON.parse(gunzipSync(await fs.readFile('research/completion/2026-11-21/chart-source-review.json.gz')));
assert.equal(manifest.schemaVersion,1);assert.equal(Object.keys(manifest.instruments).length,33);
let reviewed=0,preserved=0;
for(const [key,review] of Object.entries(manifest.instruments)){
 const source=evidence.official.find(x=>x.key===key);assert(source);assert.equal(source.adjusted,'N');
 assert.equal(createHash('sha256').update(JSON.stringify(source.bars)).digest('hex'),review.source.officialBarsSha256);
 const sourceRows=new Map(source.bars.map(b=>[b.date,b]));
 for(const proof of review.resolutions)assert.deepEqual(proof.official,sourceRows.get(proof.date),'Every selected price is a retrieved official raw observation');
 const base=review.resolutions.filter(r=>r.base).map(r=>r.base),tail=review.resolutions.map(r=>r.incoming),before=JSON.stringify({base,tail});
 const merged=mergeChartHistoryBars(base,tail,{identity:review.instrument,review,onResolution(){reviewed++}});
 assert.equal(JSON.stringify({base,tail}),before,'View reconciliation never mutates either archive');assert.equal(merged.length,tail.length);
 for(const proof of review.resolutions){const bar=merged.find(b=>b.date===proof.date);if(proof.selection==='PRESERVE_BASE'){assert.equal(bar,proof.base);preserved++;}else assert.deepEqual(bar,proof.official);}
 const first=tail[0];
 assert.throws(()=>mergeChartHistoryBars(base,[{...first,volume:first.volume+1}],{identity:review.instrument,review}),/wijkt af/,'A changed incoming observation must be reviewed again');
 assert.throws(()=>mergeChartHistoryBars(base,tail,{identity:{...review.instrument,mic:'WRONG'},review}),/instrumentidentiteit/);
 assert.throws(()=>mergeChartHistoryBars(base,tail,{identity:review.instrument,review:{...review,source:{...review.source,adjusted:'Y'}}}),/instrumentidentiteit/);
}
assert.equal(reviewed,434);assert.equal(preserved,230);
console.log('33 reviewed histories; 434 actual official raw observations; 230 exact base records retained; immutable archives and changed-source/venue/mode rejection PASS');

// The actual raw EDPR row differs from Euronext's adjusted-Y observation.
// Enforce N at the provider boundary so future imports cannot recreate the mix.
const edpr=evidence.official.find(r=>r.key==='XLIS:ES0127797019');
const actual=edpr.bars.find(r=>r.date==='2025-11-20');assert.equal(actual.close,11.55);assert.equal(actual.volume,1330437);
const fetchBefore=globalThis.fetch;
try{
 globalThis.fetch=async (url,options)=>{
  assert.equal(new URLSearchParams(options.body).get('adjusted'),'N');
  return new Response('<table><tr><th>Date</th><th>Open</th><th>High</th><th>Low</th><th>Close</th><th>Number of Shares</th></tr><tr><td>20/11/2025</td><td>'+actual.open+'</td><td>'+actual.high+'</td><td>'+actual.low+'</td><td>'+actual.close+'</td><td>'+actual.volume+'</td></tr></table>');
 };
 const {EuronextLiveProvider}=await import('./providers/euronext-live.mjs');
 const result=await new EuronextLiveProvider().fetchDaily({isin:edpr.isin,mic:edpr.mic},{startDate:actual.date,endDate:actual.date});
 assert.deepEqual(result.bars,[actual]);assert.equal(result.providerMeta.priceBasis,'UNADJUSTED');
}finally{globalThis.fetch=fetchBefore;}
console.log('Actual EDPR raw price and volume; default unadjusted source request PASS');
