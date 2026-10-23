import assert from 'node:assert/strict';
import {parseMseOfficialPriceList,mseOfficialNoTradeStatus,fetchMseOfficialPriceList,MSE_PRICE_LIST_URL} from '../history/providers/mse-official-price-list.mjs';
const lines=[
 'Malta Stock Exchange plc Price List',
 'Thursday, October 22, 2026 Issued By Authority of the Board',
 'Equities',
 'ISIN Shares in issue Symbol Code Security Average Price for the day Last Closing Price Last Traded Date High for the day Low for the day',
 'MT0000020116 642,234,197 BOV Bank of Valletta p.l.c. Ord €1.00 2.360 2.400 (22-10-26) 2.400 2.360 21-08-26 - 5.230 Interim',
 'MT0000040106 154,572,263 LOM Lombard Bank Malta p.l.c. Ord €0.125 0.687 0.730 (19-10-26) 0.730 0.685 09-07-26 - 2.220 Final',
 'MT0000070103 36,000,000 SFC Simonds Farsons Cisk p.l.c. Ord €0.30 6.179 6.150 (21-10-26) 6.200 6.150 21-10-26 - 7.000 Interim',
 'MT0000090101 101,310,488 GO GO p.l.c. Ord €0.582343 2.540 2.540 (21-10-26) 2.540 2.540 06-10-26 - 7.000 Interim',
 ...Array.from({length:25},(_,i)=>`MT${String(i+1000000000).padStart(10,'0')} 10,000 TEST${i} Test Company ${i} Ord €1.00 1.000 1.000 (20-10-26) 1.000 1.000 - - -`),
 'Corporate Bonds',
 'MT0000021312 66,500,000 BV30A Some bond 94.600 95.500 (14-10-26) 95.500 94.000'
].join('\\n');
const snapshot=parseMseOfficialPriceList(lines,{expectedDate:'2026-10-22'});
assert.equal(snapshot.rows.size,29);
assert.equal(snapshot.rows.get('MT0000040106').lastTradeDate,'2026-10-19');
assert.equal(snapshot.rows.has('MT0000021312'),false,'Bond rows must never be treated as equities');
const status=mseOfficialNoTradeStatus(snapshot,{mic:'XMAL',isin:'MT0000040106',symbol:'LOM'},'2026-10-22');
assert.equal(status.status,'NO_TRADES');
assert.equal(status.lastTradeDate,'2026-10-19');
assert.equal(status.bar,undefined,'Official price list lacks OPEN: no synthetic OHLC');
assert.equal(mseOfficialNoTradeStatus(snapshot,{mic:'XMAL',isin:'MT0000020116',symbol:'BOV'},'2026-10-22'),null,'A trade on the report date is not no-trade');
assert.equal(mseOfficialNoTradeStatus(snapshot,{mic:'XMAL',isin:'MT0000040106',symbol:'WRONG'},'2026-10-22'),null,'Symbol mismatch fails closed');
assert.equal(mseOfficialNoTradeStatus(snapshot,{mic:'XPAR',isin:'MT0000040106',symbol:'LOM'},'2026-10-22'),null,'MIC mismatch fails closed');
assert.equal(mseOfficialNoTradeStatus(snapshot,{mic:'XMAL',isin:'MT0000040106',symbol:'LOM'},'2026-10-23'),null,'Stale snapshot cannot prove no-trade');
assert.throws(()=>parseMseOfficialPriceList(lines,{expectedDate:'2026-10-21'}),/date mismatch/);
assert.throws(()=>parseMseOfficialPriceList(lines.replace('Corporate Bonds',lines.split('\\n')[4]+'\\nCorporate Bonds'),{expectedDate:'2026-10-22'}),/duplicate|incomplete/);
assert.throws(()=>parseMseOfficialPriceList(lines.replace('(19-10-26)','(23-10-26)'),{expectedDate:'2026-10-22'}),/future\\/invalid/);
const pdf=Buffer.concat([Buffer.from('%PDF-1.7\\n'),Buffer.alloc(110)]);
const response={ok:true,status:200,url:MSE_PRICE_LIST_URL,async arrayBuffer(){return pdf;}};
const fetched=await fetchMseOfficialPriceList('2026-10-22',{fetchFn:async()=>response,extractPdf:()=>lines});
assert.equal(fetched.rows.size,29);
await assert.rejects(()=>fetchMseOfficialPriceList('2026-10-22',{fetchFn:async()=>({...response,url:'https://elsewhere.example/test.pdf'}),extractPdf:()=>lines}),/unapproved host/);
await assert.rejects(()=>fetchMseOfficialPriceList('2026-10-22',{fetchFn:async()=>({...response,async arrayBuffer(){return Buffer.from('not a pdf');}}),extractPdf:()=>lines}),/not a bounded PDF/);
console.log('MSE official price list: strict ISIN+symbol, exact snapshot date, no-trade only, no OHLC, source and PDF safety PASS');
