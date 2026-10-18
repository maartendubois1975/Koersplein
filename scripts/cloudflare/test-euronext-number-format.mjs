import assert from 'node:assert/strict';
import {parseEuronextNumber,parseEuronextHistoryRows} from '../history/providers/euronext-live.mjs';
for(const [input,expected] of [['12,34',12.34],['12.34',12.34],['1,234.56',1234.56],['1.234,56',1234.56],['1 234,56',1234.56],['1,234',1234],['-',null],['invalid',null]]){
 assert.equal(parseEuronextNumber(input),expected,input);
}
const html='<table><tr><th>Date</th><th>Open</th><th>High</th><th>Low</th><th>Close</th><th>Number of shares</th></tr><tr><td>16/10/2026</td><td>12,34</td><td>12,90</td><td>12,10</td><td>12,75</td><td>1,234</td></tr></table>';
const bars=parseEuronextHistoryRows(html);
assert.equal(bars.length,1);
assert.equal(bars[0].open,12.34);
assert.equal(bars[0].close,12.75);
assert.equal(bars[0].volume,1234);
console.log('Euronext decimal and grouping formats: OK');
