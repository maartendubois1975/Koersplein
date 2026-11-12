// Isolated public-page regression; synthetic fixtures never enter production.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../../market.html',import.meta.url),'utf8');
const amsterdamHtml=await readFile(new URL('../../amsterdam.html',import.meta.url),'utf8');
assert.match(amsterdamHtml,/market\.html\?market=amsterdam/,'Legacy Amsterdam URL must redirect to canonical market page');
assert.doesNotMatch(amsterdamHtml,/amsterdam-week\.js/,'Legacy page must not run a duplicate renderer');
const homepage=await readFile(new URL('../../index.html',import.meta.url),'utf8');
const shareScript=await readFile(new URL('../../share.js',import.meta.url),'utf8');
assert.doesNotMatch(homepage,/Bekijk de handelsweek 19–23 oktober 2026/,'Homepage must not present a frozen reference week as current');
assert.match(shareScript,/market\.id==='amsterdam'\?'market\.html\?market=amsterdam'/,'Amsterdam detail back-link must use the single canonical market page');
const plan=JSON.parse(await readFile(new URL('../../data/world-fill-plan.json',import.meta.url),'utf8'));
assert.equal(plan.markets.find(x=>x.mic==='XAMS')?.state,'INCOMPLETE',
 'XAMS must not claim COMPLETE while the fixed 2026-10-19..23 week still has 47 unresolved sessions');
assert.match(html,/generic-market\.js\?v=20261026xams-retry1/,'Browser must fetch updated JS');
const browserJs=await readFile(new URL('../../generic-market.js',import.meta.url),'utf8');
assert.match(browserJs,/market-week-core\.mjs\?v=20261026xams-retry1/,'Browser must fetch the updated shared OHLCV validator');
const nodes=new Map();
globalThis.document={querySelector(selector){
 if(!nodes.has(selector))nodes.set(selector,{value:'',textContent:'',innerHTML:'',addEventListener(){}});
 return nodes.get(selector);
}};
globalThis.location={search:'?market=amsterdam'};
const today=new Date(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())+'T12:00:00Z');
const weekday=today.getUTCDay(),monday=new Date(today);
monday.setUTCDate(monday.getUTCDate()-((weekday+6)%7)-(weekday>=1&&weekday<=5?7:0));
const rollingDates=Array.from({length:5},(_,i)=>{const d=new Date(monday);d.setUTCDate(d.getUTCDate()+i);return d.toISOString().slice(0,10)});
// Both Amsterdam pages use the same last completed week.
let dates=rollingDates;
const shares=[
 {isin:'NL0000852564',symbol:'AALB',name:'Aalberts'},
 {isin:'NL0011540547',symbol:'ABN',name:'ABN AMRO'},
 {isin:'NL0010273215',symbol:'ASML',name:'ASML'}
];
const manifest={instruments:Object.fromEntries(shares.map(s=>['XAMS:'+s.isin,{mic:'XAMS',symbol:s.symbol,isin:'XAMS:'+s.isin}]))};
const bar=(date,volume=100)=>({date,open:100,high:110,low:95,close:105,volume});
const histories={
 'XAMS:NL0000852564':{instrument:{isin:'XAMS:NL0000852564',mic:'XAMS',symbol:'AALB',currency:'EUR'},coverage:{lastDate:dates[1]},bars:[bar(dates[0]),bar(dates[1],0)]},
 'XAMS:NL0011540547':{instrument:{isin:'XAMS:NL0011540547',mic:'XAMS',symbol:'ABN',currency:'EUR'},coverage:{lastDate:dates[4]},bars:[bar(dates[0]),bar(dates[1],0),bar(dates[4])]},
 'XAMS:NL0010273215':{instrument:{isin:'XAMS:NL9999999999',mic:'XAMS',symbol:'ASML',currency:'EUR'},coverage:{lastDate:dates[4]},bars:dates.map(date=>bar(date))}
};
const status={schemaVersion:1,mic:'XAMS',scope:'OFFICIAL_NO_TRADES_STATUS_ONLY_NO_PRICE_DATA',week:dates,
 auditCommit:'a'.repeat(40),auditRun:'123',tickers:{NL0011540547:'ABN'},noTrades:{NL0011540547:[dates[1]]}};
globalThis.fetch=async url=>{
 const path=String(url);
 let data;
 if(path.endsWith('data/world-fill-plan.json'))data={markets:[{code:'amsterdam',mic:'XAMS',name:'Amsterdam',country:'NL',currency:'EUR'}]};
 else if(path.endsWith('data/euronext-amsterdam.json'))data={shares};
 else if(path.endsWith('data/amsterdam-no-trades-2026-10-19-23.json'))data=status;
 else if(path.endsWith('/api/history/manifest.json'))data=manifest;
 else if(path.endsWith('data/amsterdam-history-manifest.json'))data={instruments:Object.fromEntries(shares.map(s=>[s.isin,{mic:'XAMS',symbol:s.symbol,isin:s.isin}]))};
 else if(path.includes('data/history/')){const isin=decodeURIComponent(path.split('/').at(-1)).replace(/\.json$/,'');const row=histories['XAMS:'+isin];if(row)data={...row,instrument:{...row.instrument,isin:row.instrument.isin==='XAMS:NL9999999999'?'NL9999999999':isin}};}
 else if(path.includes('/api/history/'))data=histories[decodeURIComponent(path.split('/').at(-1))];
 if(!data)throw Error('Unexpected test fetch '+path);
 return {ok:true,status:200,json:async()=>data};
};
await import('../../generic-market.js?test=xams-five-sessions');
let output='';
for(let i=0;i<100;i++){
 output=nodes.get('#share-groups')?.innerHTML||'';
 if(output.includes('Amsterdam · vijf afgesloten handelsdagen'))break;
 await new Promise(resolve=>setTimeout(resolve,20));
}
assert.match(output,/Amsterdam · vijf afgesloten handelsdagen/,'Public XAMS page must render all five days');
assert.match(output,/share\.html\?isin=NL0000852564&amp;mic=XAMS|share\.html\?isin=NL0000852564&mic=XAMS/,'Amsterdam company must link to its validated history chart');
assert.match(output,/Geen handel \(officieel\)/,'Audited NO_TRADES must be visible');
assert.match(output,new RegExp('<tr><td>'+dates[1]+'</td><td>0</td><td>1</td><td>1</td><td>0</td><td>1</td></tr>'),
 'Official NO_TRADES must override invalid zero-volume reference bars, while other invalid bars remain quarantined');
assert.match(output,/Ongeldige koers/,'Zero-volume source bars must not be published');
assert.match(output,/Verouderde historie/,'Old as-of date must be classified');
assert.match(output,/Niet bevestigd/,'ISIN mismatch must not borrow prices');
assert.match(output,/\+5\.00 EUR \/ \+5\.00%/,'Close-open and percentage must be calculated');
assert.doesNotMatch(output,/€\s*0,00/,'Missing OHLC must never appear as zero prices');
assert.match(nodes.get('#market-meta').textContent,/afgesloten/);
assert.equal((output.match(/<tr>/g)||[]).length,23,'Two headers, five-day summary, total and 3 x 5 rows');
assert.equal((output.match(/Geldige koers/g)||[]).length,3,'Only real traded bars pass');
console.log('Public Amsterdam: five sessions, MIC+ISIN+ticker+currency, audited NO_TRADES, stale/invalid, deltas and cache bust PASS');

console.log('Amsterdam has one canonical market renderer; legacy URL redirects without loading a second data pipeline PASS');
