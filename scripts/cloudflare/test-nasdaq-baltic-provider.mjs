import assert from 'node:assert/strict';
import {NasdaqBalticProvider,parseTrading,parse} from '../history/providers/nasdaq-baltic.mjs';

const traded='<div>Trades 3 Volume 150 Open 1.2 High 1.4 Low 1.1 1.3 EUR +0.1%</div>';
assert.deepEqual(parseTrading(traded,'2026-10-22'),{
 date:'2026-10-22',open:1.2,high:1.4,low:1.1,close:1.3,adjustedClose:1.3,volume:150
});
assert.equal(parseTrading('<div>Trades 3 Volume 150 Open 1.2 Low 1.1 1.3 EUR +0.1%</div>','2026-10-22'),null,'Missing high must not be fabricated');
assert.equal(parseTrading('<div>Trades 3 Volume 150 Open 1.2 High 1.25 Low 1.1 1.3 EUR +0.1%</div>','2026-10-22'),null,'High below close is invalid');

const history='<table><tr><th>Date</th><th>Open</th><th>High</th><th>Low</th><th>Close</th><th>Volume</th></tr>'+
 '<tr><td>2026-10-22</td><td>1.2</td><td>1.4</td><td>1.1</td><td>1.3</td><td>150</td></tr>'+
 '<tr><td>2026-10-21</td><td>-</td><td>-</td><td>-</td><td>1.2</td><td>0</td></tr>'+
 '<tr><td>2026-10-20</td><td>1.1</td><td>1.2</td><td>1.0</td><td>1.3</td><td>10</td></tr></table>';
assert.deepEqual(parse(history).map(b=>b.date),['2026-10-22'],'Close-only or inconsistent OHLC cannot become a synthetic daily bar');

const provider=new NasdaqBalticProvider();
const originalFetch=globalThis.fetch,requested=[];
try{
 globalThis.fetch=async url=>{
  requested.push(String(url));
  return {ok:true,async text(){return String(url).includes('/historical')?history:traded;}};
 };
 const instrument={mic:'XLIT',isin:'LT0000128860'};
 const archive=await provider.fetchDaily(instrument,{startDate:'1990-01-01',endDate:'2026-10-22'});
 assert.equal(archive.bars.length,1);
 assert.match(requested[0],/\/historical$/,'Long backfill must use historical source, not one recent trading session');
 requested.length=0;
 const daily=await provider.fetchDaily(instrument,{startDate:'2026-10-22',endDate:'2026-10-22'});
 assert.equal(daily.bars.length,1);
 assert.match(requested[0],/\/trading\?date=2026-10-22$/,'Daily append uses official trading session');
}finally{globalThis.fetch=originalFetch;}
console.log('Nasdaq Baltic: official ISIN routing, real OHLC, no fabricated prices, long-range history PASS');
