import assert from 'node:assert/strict';
import {validateDailyOHLCV} from './usa-ohlcv-validation.mjs';
const b={date:'2026-10-15',open:10,high:12,low:9,close:11,volume:200,tradeCount:9};
const good=[{...b,date:'2026-10-14'},{...b}];
assert.deepEqual(validateDailyOHLCV(good,{start:'2026-10-01',end:'2026-10-15'}),{records:2,firstDate:'2026-10-14',lastDate:'2026-10-15'});
assert.deepEqual(validateDailyOHLCV([]),{records:0,firstDate:null,lastDate:null});
const bad = [
  [[{...b,date:'2026-02-30'}],/INVALID_TRADING_DATE/],
  [[{...b,date:'2026-10-15T00:00:00Z'}],/INVALID_TRADING_DATE/],
  [[{...b,date:null}],/INVALID_TRADING_DATE/],
  [[{...b}, {...b}],/NON_INCREASING_TRADING_DATES/],
  [[{...b}, {...b,date:'2026-10-14'}],/NON_INCREASING_TRADING_DATES/],
  [[{...b,open:0}],/INVALID_PRICE/],
  [[{...b,high:10}],/INCONSISTENT_OHLC/],
  [[{...b,low:11}],/INCONSISTENT_OHLC/],
  [[{...b,close:NaN}],/INVALID_PRICE/],
  [[{...b,volume:-1}],/INVALID_VOLUME/],
  [[{...b,volume:1.2}],/INVALID_VOLUME/],
  [[{...b,tradeCount:-2}],/INVALID_TRADE_COUNT/],
  [[{...b,tradeCount:0.3}],/INVALID_TRADE_COUNT/],
  [[{...b,volume:'100'}],/INVALID_VOLUME/],
  [[{...b,volume:Number.MAX_SAFE_INTEGER+1}],/INVALID_VOLUME/],
];
for(const [bars,pattern] of bad)assert.throws(()=>validateDailyOHLCV(bars),pattern);
assert.throws(()=>validateDailyOHLCV([b],{start:'2026-10-16'}),/OUT_OF_WINDOW_DATE/);
assert.throws(()=>validateDailyOHLCV([b],{end:'2026-10-14'}),/OUT_OF_WINDOW_DATE/);
assert.throws(()=>validateDailyOHLCV([b],{start:'2026-10-16',end:'2026-10-14'}),/INVERTED_HISTORY_WINDOW/);
assert.throws(()=>validateDailyOHLCV([b],{start:'2026-02-30'}),/INVALID_HISTORY_START/);
assert.throws(()=>validateDailyOHLCV([b],{end:'2026-13-01'}),/INVALID_HISTORY_END/);
assert.throws(()=>validateDailyOHLCV({}),/INVALID_BARS_ARRAY/);
console.log('US daily OHLCV offline regressions passed: 23');
