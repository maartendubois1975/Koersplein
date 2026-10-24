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
 // Inverted HIGH/LOW is distinct from a missing field. Preserve the raw
 // contradiction only in the read-only route, never in production bars.
 globalThis.fetch=async()=>({ok:true,async json(){return {chart:{result:[{
  meta,timestamp:[Math.floor(Date.parse('2026-10-22T12:00:00Z')/1000)],
  indicators:{quote:[{open:[100],high:[80],low:[90],close:[105],volume:[100]}]}
 }]}};}});
 const productionInverted=await yahoo.fetchDaily(base,{startDate:'2026-10-22',endDate:'2026-10-22'});
 assert.equal(productionInverted.bars[0].high,null);
 assert.equal(productionInverted.bars[0].low,null);
 const readOnlyInverted=await yahoo.fetchDaily(base,{startDate:'2026-10-22',endDate:'2026-10-22',includeIncompleteBars:true});
 assert.equal(readOnlyInverted.bars[0].high,80);
 assert.equal(readOnlyInverted.bars[0].low,90);
 assert.equal(describeExactDateSourceBars(readOnlyInverted.bars,'2026-10-22').defects.HIGH_BELOW_LOW,1);

} finally {globalThis.fetch=originalFetch;}
console.log('Yahoo incomplete OPEN/CLOSE preserved only for read-only source diagnostics PASS');

// Currency is a listing identity invariant for EVERY approved Yahoo venue.
// A valid MIC/symbol alone cannot authorize a different currency trading line.
for (const [mic,symbol,exchange,expected,wrong] of [
 ['XPAR','TEST.PA','PAR','EUR','USD'],
 ['XETR','TEST.DE','GER','EUR','CHF'],
 ['XSTO','TEST.ST','STO','SEK','EUR'],
 ['XBSE','TEST.RO','BVB','RON','EUR']
]) {
 const listing={isin:'GB0000000001',mic,providerSymbol:symbol,currency:expected};
 const venue={symbol,exchangeName:exchange,currency:expected.toLowerCase()};
 assert.doesNotThrow(()=>yahoo.validateIdentity(listing,venue),mic+' exact quote currency');
 assert.throws(()=>yahoo.validateIdentity(listing,{...venue,currency:wrong}),/Providervaluta wijkt af/,mic+' mismatched quote currency must fail closed');
 assert.throws(()=>yahoo.validateIdentity(listing,{...venue,currency:null}),/Providervaluta wijkt af/,mic+' unknown provider currency must fail closed');
}
// Legacy catalog rows with no asserted currency are not retroactively assigned
// one. Such rows must still pass the independent MIC and ticker checks.
assert.doesNotThrow(()=>yahoo.validateIdentity({mic:'XPAR',providerSymbol:'TEST.PA'},
 {symbol:'TEST.PA',exchangeName:'PAR',currency:'EUR'}));
console.log('Yahoo approved venue/currency identity guard across Europe PASS');

// A Yahoo symbol suffix and matching currency do not prove the venue if
// Yahoo omits both exchange labels. Production must fail closed, while one
// explicit approved exchange label is sufficient for legacy Yahoo responses.
for(const [mic,symbol,exchange,currency] of [
 ['XPAR','TEST.PA','PAR','EUR'],
 ['XETR','TEST.DE','GER','EUR'],
 ['XSTO','TEST.ST','STO','SEK'],
 ['XBSE','TEST.RO','BVB','RON'],
 ['XLON','TEST.L','LSE','GBp'],
 ['XSWX','TEST.SW','EBS','CHF']
]){
 const listing={isin:'GB0000000001',mic,providerSymbol:symbol,currency:mic==='XLON'?'GBX':currency};
 const noVenue={symbol,currency};
 assert.throws(()=>yahoo.validateIdentity(listing,noVenue),/Providerbeurs ontbreekt/,mic+' no exchange metadata must not be accepted');
 assert.throws(()=>yahoo.validateIdentity(listing,{...noVenue,exchangeName:' ',fullExchangeName:null}),/Providerbeurs ontbreekt/,mic+' blank exchange metadata must not be accepted');
 assert.doesNotThrow(()=>yahoo.validateIdentity(listing,{...noVenue,exchangeName:exchange}),mic+' single verified exchange label');
 assert.throws(()=>yahoo.validateIdentity(listing,{...noVenue,exchangeName:'OTHER'}),/Providerbeurs wijkt af/,mic+' wrong exchange must fail');
}
const previousFetch=globalThis.fetch;
try{
 globalThis.fetch=async()=>({ok:true,async json(){return {chart:{result:[{
  meta:{symbol:'III.L',currency:'GBp'},
  timestamp:[Math.floor(Date.parse('2026-10-22T12:00:00Z')/1000)],
  indicators:{quote:[{open:[100],high:[110],low:[90],close:[105]}]}
 }]}};}});
 await assert.rejects(()=>yahoo.fetchDaily(base,{startDate:'2026-10-22',endDate:'2026-10-22'}),/Providerbeurs ontbreekt/,'No unverified venue candle can enter production');
}finally{globalThis.fetch=previousFetch;}
console.log('Yahoo missing venue identity fail-closed across approved European MICs PASS');
