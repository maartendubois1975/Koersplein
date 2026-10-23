import assert from 'node:assert/strict';
import {YahooChartProvider} from '../history/providers/yahoo-chart.mjs';

const chart=new YahooChartProvider();
const valor={isin:'AT0000KTMI02',mic:'XSWX',ticker:'41860974',currency:'CHF'};
assert.equal(chart.supports(valor),false);
assert.equal(chart.providerSymbolFor(valor),null,'Do not manufacture <numeric SIX valor>.SW in direct calls');
const verified={...valor,providerSymbol:'BMAG.SW'};
assert.equal(chart.providerSymbolFor(verified),'BMAG.SW');
const meta={symbol:'BMAG.SW',exchangeName:'EBS',fullExchangeName:'SIX Swiss Exchange',currency:'CHF'};
assert.doesNotThrow(()=>chart.validateIdentity(verified,meta));
assert.throws(()=>chart.validateIdentity(verified,{...meta,currency:'USD'}),/Providervaluta wijkt af/);
assert.throws(()=>chart.validateIdentity(verified,{...meta,currency:null}),/Providervaluta wijkt af/);
assert.throws(()=>chart.validateIdentity(verified,{...meta,exchangeName:'LSE',fullExchangeName:'London Stock Exchange'}),/Providerbeurs wijkt af/);
assert.throws(()=>chart.validateIdentity(verified,{...meta,symbol:'WRONG.SW'}),/Providersymbool wijkt af/);
console.log('Swiss Yahoo numeric valor, verified override, MIC and currency identity PASS');
