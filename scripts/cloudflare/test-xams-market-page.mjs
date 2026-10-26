// Isolated public-page regression; synthetic fixtures never enter production.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../../market.html',import.meta.url),'utf8');
const amsterdamHtml=await readFile(new URL('../../amsterdam.html',import.meta.url),'utf8');
assert.match(amsterdamHtml,/amsterdam-week\.js\?v=20261026xams-prevclose3/,'Amsterdam detail page must load the fixed previous-close renderer');
const plan=JSON.parse(await readFile(new URL('../../data/world-fill-plan.json',import.meta.url),'utf8'));
assert.equal(plan.markets.find(x=>x.mic==='XAMS')?.state,'INCOMPLETE',
 'XAMS must not claim COMPLETE while the fixed 2026-10-19..23 week still has 47 unresolved sessions');
assert.match(html,/generic-market\.js\?v=20261026xams-isin2/,'Browser must fetch updated JS');
const browserJs=await readFile(new URL('../../generic-market.js',import.meta.url),'utf8');
assert.match(browserJs,/market-week-core\.mjs\?v=20261026xams-isin2/,'Browser must fetch the updated shared OHLCV validator');
const nodes=new Map();
globalThis.document={querySelector(selector){
 if(!nodes.has(selector))nodes.set(selector,{value:'',textContent:'',innerHTML:'',addEventListener(){}});
 return nodes.get(selector);
}};
globalThis.location={search:'?market=amsterdam'};
const dates=['2026-10-19','2026-10-20','2026-10-21','2026-10-22','2026-10-23'];
const shares=[
 {isin:'NL0000852564',symbol:'AALB',name:'Aalberts'},
 {isin:'NL0011540547',symbol:'ABN',name:'ABN AMRO'},
 {isin:'NL0010273215',symbol:'ASML',name:'ASML'}
];
const manifest={instruments:Object.fromEntries(shares.map(s=>['XAMS:'+s.isin,{mic:'XAMS',symbol:s.symbol,isin:'XAMS:'+s.isin}]))};
const bar=(date,volume=100)=>({date,open:100,high:110,low:95,close:105,volume});
const histories={
 'XAMS:NL0000852564':{instrument:{isin:'XAMS:NL0000852564',mic:'XAMS',symbol:'AALB',currency:'EUR'},coverage:{lastDate:'2026-10-20'},bars:[bar(dates[0]),bar(dates[1],0)]},
 'XAMS:NL0011540547':{instrument:{isin:'XAMS:NL0011540547',mic:'XAMS',symbol:'ABN',currency:'EUR'},coverage:{lastDate:'2026-10-23'},bars:[bar(dates[0]),bar(dates[1],0),bar(dates[4])]},
 'XAMS:NL0010273215':{instrument:{isin:'XAMS:NL9999999999',mic:'XAMS',symbol:'ASML',currency:'EUR'},coverage:{lastDate:'2026-10-23'},bars:dates.map(date=>bar(date))}
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
assert.match(output,/Geen handel \(officieel\)/,'Audited NO_TRADES must be visible');
assert.match(output,/<tr><td>2026-10-20<\/td><td>0<\/td><td>1<\/td><td>1<\/td><td>0<\/td><td>1<\/td><\/tr>/,
 'Official NO_TRADES must override invalid zero-volume reference bars, while other invalid bars remain quarantined');
assert.match(output,/Ongeldige koers/,'Zero-volume source bars must not be published');
assert.match(output,/Verouderde historie/,'Old as-of date must be classified');
assert.match(output,/Niet bevestigd/,'ISIN mismatch must not borrow prices');
assert.match(output,/\+5\.00 EUR \/ \+5\.00%/,'Close-open and percentage must be calculated');
assert.doesNotMatch(output,/€\s*0,00/,'Missing OHLC must never appear as zero prices');
assert.match(nodes.get('#market-meta').textContent,/19–23 oktober 2026 \(afgesloten\)/);
assert.equal((output.match(/<tr>/g)||[]).length,23,'Two headers, five-day summary, total and 3 x 5 rows');
assert.equal((output.match(/Geldige koers/g)||[]).length,3,'Only real traded bars pass');
console.log('Public Amsterdam: five sessions, MIC+ISIN+ticker+currency, audited NO_TRADES, stale/invalid, deltas and cache bust PASS');

// The separate amsterdam.html renderer must use the same five-state rules,
// and close-to-previous-close must NOT be the overnight opening gap.
histories['XAMS:NL0000852564'].bars=[
 bar(dates[0]),{...bar(dates[1]),open:102,close:108},bar(dates[2],0)
];
// ABN has a verified NO_TRADES Tuesday followed by a real Wednesday trade.
// Wednesday's previous close is Monday's close, not Tuesday's nonexistent close.
histories['XAMS:NL0011540547'].bars.push({...bar(dates[2]),open:100,close:108});
const weekTarget={innerHTML:'',textContent:''};
const weekCount={textContent:''};
const weekSearch={value:'',addEventListener(){}};
globalThis.document={getElementById:id=>({
 'week-prices-table':weekTarget,'share-count':weekCount,search:weekSearch
}[id]||null)};
globalThis.window={KOERSPLEIN_MARKET:{mic:'XAMS',api:'https://koersplein.maarten-dubois1975.workers.dev'}};
await import('../../amsterdam-week.js?test=xams-five-state-parity');
for(let i=0;i<100&&!weekTarget.innerHTML.includes('<table>');i++)
 await new Promise(resolve=>setTimeout(resolve,20));
const weekOutput=weekTarget.innerHTML;
assert.match(weekOutput,/Slot t\.o\.v\. vorig slot/,'The second delta must be close-to-previous-close');
assert.match(weekOutput,/\+3,00 EUR \/ \+2,86%/,'Close 108 versus previous close 105 is +3 (+2.86%), not the opening gap');
const abnRow=weekOutput.split('</tr>').find(x=>x.includes('>ABN · '));
assert.ok(abnRow,'ABN row missing');
assert.match(abnRow,/\+3,00 EUR \/ \+2,86%/,'An officially confirmed NO_TRADES session must not break previous-close return');
assert.match(abnRow,/2026-10-23[^]*?<td class="price">—<\/td>/,'Unverified intervening Thursday must block Friday previous-close return');
const sessions=[...weekOutput.matchAll(/data-session-date="(2026-10-\d{2})" data-session-status="(valid|noTrades|invalid|stale|missing)"/g)];
assert.equal(sessions.length,15,'Every share/date needs one explicit public status');
const statusCounts=sessions.reduce((o,m)=>(o[m[2]]=(o[m[2]]||0)+1,o),{});
assert.deepEqual(statusCounts,{valid:5,invalid:1,stale:2,noTrades:1,missing:6},
 'Public status partition must match the generic renderer for the same fixture');
for(const statusLabel of ['Ongeldige koers','Verouderde historie','Niet bevestigd','Geen handel'])
 assert.ok(weekOutput.includes(statusLabel),'Explicit missing-session classification: '+statusLabel);
assert.doesNotMatch(weekOutput,/€\s*0,00/,'Missing sessions must not be zero-priced');
console.log('Amsterdam detail page: five explicit session states, previous-close through official NO_TRADES only, no synthetic prices PASS');
