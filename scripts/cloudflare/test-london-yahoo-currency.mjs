import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {YahooChartProvider} from '../history/providers/yahoo-chart.mjs';
const catalog=JSON.parse(await fs.readFile('data/euronext-london.json','utf8'));
const shares=catalog.shares||catalog.instruments||[];
const counts=shares.reduce((a,s)=>(a[s.currency]=(a[s.currency]||0)+1,a),{});
assert.ok(counts.GBX>1000,'LSE catalog is predominantly quoted in pence (GBX)');
const yahoo=new YahooChartProvider();
const base={isin:'GB00B1YW4409',mic:'XLON',ticker:'III',currency:'GBX',providerSymbol:'III.L'};
const meta={symbol:'III.L',exchangeName:'LSE',fullExchangeName:'London Stock Exchange',currency:'GBp'};
assert.doesNotThrow(()=>yahoo.validateIdentity(base,meta),'Yahoo GBp equals catalog GBX pence');
assert.doesNotThrow(()=>yahoo.validateIdentity({...base,currency:'GBP'},{...meta,currency:'GBP'}));
assert.doesNotThrow(()=>yahoo.validateIdentity({...base,currency:'USD'},{...meta,currency:'USD'}));
assert.throws(()=>yahoo.validateIdentity(base,{...meta,currency:'GBP'}),/Providervaluta wijkt af/,'Pence cannot be stored as pounds');
assert.throws(()=>yahoo.validateIdentity({...base,currency:'GBP'},meta),/Providervaluta wijkt af/,'Pounds cannot be stored as pence');
assert.throws(()=>yahoo.validateIdentity(base,{...meta,currency:'USD'}),/Providervaluta wijkt af/);
assert.throws(()=>yahoo.validateIdentity(base,{...meta,currency:null}),/Providervaluta wijkt af/);
assert.throws(()=>yahoo.validateIdentity(base,{...meta,exchangeName:'EBS',fullExchangeName:'SIX Swiss Exchange'}),/Providerbeurs wijkt af/);
console.log('London GBX/GBp versus GBP 100x unit identity and exchange guard PASS');


// Historical source diagnosis must see null OPEN/CLOSE from Yahoo; the
// production adapter still excludes them unless explicitly asked read-only.
const originalFetch=globalThis.fetch;
try {
 const timestamps=['2026-10-19','2026-10-20','2026-10-21','2026-10-22'].map(day=>Math.floor(Date.parse(day+'T12:00:00Z')/1000));
 globalThis.fetch=async()=>({ok:true,async json(){return {chart:{result:[{
  meta, timestamp:timestamps,
  indicators:{quote:[{open:[100,null,102,103],high:[110,110,110,null],low:[90,90,90,90],close:[105,105,null,105],volume:[100,100,100,100]}]}
 }]}};}});
 const dates={startDate:'2026-10-19',endDate:'2026-10-22'};
 const normal=await yahoo.fetchDaily(base,dates);
 assert.deepEqual(normal.bars.map(x=>x.date),['2026-10-19','2026-10-22'],'Normal production path must still drop missing OPEN/CLOSE');
 const diagnostic=await yahoo.fetchDaily(base,{...dates,includeIncompleteBars:true});
 assert.deepEqual(diagnostic.bars.map(x=>x.date),['2026-10-19','2026-10-20','2026-10-21','2026-10-22']);
 assert.equal(diagnostic.bars[1].open,null,'Read-only evidence must retain missing OPEN as null');
 assert.equal(diagnostic.bars[2].close,null,'Read-only evidence must retain missing CLOSE as null');
 assert.equal(diagnostic.bars[3].high,null,'Read-only evidence must never fabricate HIGH');
 const {describeExactDateSourceBars}=await import('./europe-ohlc-source-evidence.mjs');
 assert.equal(describeExactDateSourceBars(diagnostic.bars,'2026-10-20').defects.INVALID_OR_MISSING_OPEN,1);
 assert.equal(describeExactDateSourceBars(diagnostic.bars,'2026-10-21').defects.INVALID_OR_MISSING_CLOSE,1);
 assert.equal(describeExactDateSourceBars(diagnostic.bars,'2026-10-22').defects.INVALID_OR_MISSING_HIGH,1);
} finally {globalThis.fetch=originalFetch;}
console.log('Yahoo incomplete OPEN/CLOSE preserved only for read-only source diagnostics PASS');
