import assert from 'node:assert/strict';
import {createHash,createCipheriv} from 'node:crypto';
import {parseBalticStatistics,zseRowStatus} from '../history/official-daily-status.mjs';
import {decodeEuronextBody,parseEuronextHistoryRows,euronextProviderMic,EuronextLiveProvider} from '../history/providers/euronext-live.mjs';
const html='<input name="end" data-value="2026-10-16"><table><tr><th>Last price date</th><th>Open price</th></tr><tr><td><a href="/statistics/en/instrument/LT0000128860/trading">Company</a></td><td>VLN</td><td>+1</td><td>5.3</td><td>16.10.2026</td><td>5.2</td><td>5.3<br>5.2<br></td><td>4</td><td>241</td><td>1,277</td></tr><tr><td><a href="/statistics/en/instrument/LT0000132953/trading">Other</a></td><td>VLN</td><td>-</td><td>2.94</td><td>14.10.2026</td><td>2.94</td><td>-<br>-</td><td>0</td><td>0</td><td>0</td></tr></table>';
const rows=parseBalticStatistics(html,'2026-10-16');
assert.equal(rows.get('LT0000128860').bar.close,5.3);
assert.equal(rows.get('LT0000132953').status,'NO_TRADES');
assert.equal(rows.get('LT0000132953').bar,undefined);
assert.throws(()=>parseBalticStatistics(html,'2026-10-15'),/date mismatch/);

const laterBalticHtml=html.replace('data-value="2026-10-16"','data-value="2026-10-17"');
assert.throws(()=>parseBalticStatistics(laterBalticHtml,'2026-10-16'),/date mismatch/,'Exact Baltic snapshot remains the default');
const laterBaltic=parseBalticStatistics(laterBalticHtml,'2026-10-16',{allowLaterNoTrade:true});
assert.equal(laterBaltic.get('LT0000132953').status,'NO_TRADES','Later official last-trade date proves an earlier no-trade session');
assert.equal(laterBaltic.get('LT0000132953').snapshotDate,'2026-10-17','The actual later source date must be preserved');
assert.equal(laterBaltic.has('LT0000128860'),false,'Never misattribute a later trading-session price to the target day');
const tradedTargetInLater=laterBalticHtml.replace('14.10.2026','16.10.2026');
assert.equal(parseBalticStatistics(tradedTargetInLater,'2026-10-16',{allowLaterNoTrade:true}).has('LT0000132953'),false,'Target-day last trade cannot be marked NO_TRADES');
assert.throws(()=>parseBalticStatistics(laterBalticHtml.replace('2026-10-17','2026-10-25'),'2026-10-16',{allowLaterNoTrade:true}),/date mismatch/,'Look-ahead is bounded to seven days');
assert.throws(()=>parseBalticStatistics(laterBalticHtml.replace('2026-10-17','2026-10-15'),'2026-10-16',{allowLaterNoTrade:true}),/date mismatch/,'Older source snapshots cannot prove a later target');
assert.throws(()=>parseBalticStatistics(laterBalticHtml,'2026-02-31',{allowLaterNoTrade:true}),/date mismatch/,'Impossible target calendar dates are rejected');

assert.equal(zseRowStatus({date:'2026-10-16',trade_date:'2026-10-02',mic:'XZAG',isin:'TEST',num_trades:'0',volume:'0',close_price:'128'},'2026-10-16').status,'NO_TRADES');
assert.equal(zseRowStatus({date:'2026-10-15',trade_date:'2026-10-02',num_trades:'0',volume:'0'},'2026-10-16'),null);
const table='<table><tr><th>Date</th><th>Open</th><th>High</th><th>Low</th><th>Last</th><th>Close</th><th>Number of shares</th></tr><tr><td>16/10/2026</td><td>-</td><td>-</td><td>-</td><td>2.26</td><td>2.26</td><td>0</td></tr></table>';
const salt=Buffer.from('0001020304050607','hex'),password=Buffer.from('24ayqVo7yJma');let prev=Buffer.alloc(0),derived=Buffer.alloc(0);
while(derived.length<48){prev=createHash('md5').update(Buffer.concat([prev,password,salt])).digest();derived=Buffer.concat([derived,prev]);}
const iv=derived.subarray(32,48),cipher=createCipheriv('aes-256-cbc',derived.subarray(0,32),iv);
const payload=JSON.stringify({ct:Buffer.concat([cipher.update(JSON.stringify(table)),cipher.final()]).toString('base64'),iv:iv.toString('hex'),s:salt.toString('hex')});
assert.equal(decodeEuronextBody(payload),table);
const bar=parseEuronextHistoryRows(decodeEuronextBody(payload))[0];assert.equal(bar.open,null);assert.equal(bar.volume,0);
assert.equal(decodeEuronextBody(table),table);
console.log('Official status: traded prices, explicit no-trade days, stale snapshot rejection and Euronext public transport OK');

assert.equal(euronextProviderMic('XDUB'),'XMSM');
assert.equal(euronextProviderMic('XESM'),'XESM');
assert.equal(new EuronextLiveProvider().supports({mic:'XESM',isin:'IE00038O9UC4'}),true);
