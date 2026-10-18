import assert from 'node:assert/strict';
import {lastFullSession,previousSession,standardNYSEHoliday,newYorkDate,inspectYahooChart,SAMPLES,assertCurrentCanaryEvidence,canProbeCatalogCandidate} from './usa-daily-canary-core.mjs';
assert.equal(lastFullSession(new Date('2026-10-17T05:00:00Z')),'2026-10-16');
assert.equal(lastFullSession(new Date('2026-10-16T19:59:00Z')),'2026-10-15');
assert.equal(lastFullSession(new Date('2026-10-16T21:01:00Z')),'2026-10-16');
assert.equal(previousSession('2026-10-19'),'2026-10-16');
assert.equal(standardNYSEHoliday('2026-11-26'),true);
assert.equal(standardNYSEHoliday('2026-04-03'),true);
assert.equal(lastFullSession(new Date('2026-11-27T14:00:00Z')),'2026-11-25');
assert.equal(newYorkDate(new Date('2026-10-17T01:00:00Z')),'2026-10-16');
assert.equal(SAMPLES.find(x=>x.symbol==='BRK.B').providerTicker,'BRK-B');
const ts=Date.parse('2026-10-16T20:00:00Z')/1000;
const good={chart:{result:[{meta:{symbol:'MMM',exchangeName:'NYQ',currency:'USD',instrumentType:'EQUITY',exchangeTimezoneName:'America/New_York'},timestamp:[ts],indicators:{quote:[{open:[100],high:[103],low:[99],close:[101],volume:[1000]}]}}],error:null}};
const p={mic:'XNYS',providerTicker:'MMM',session:'2026-10-16',previous:'2026-10-15'};
assert.equal(inspectYahooChart(good,p).status,'DATED_OHLC_RESEARCH_ONLY');
assert.equal(inspectYahooChart(good,{...p,mic:'TXSE'}).status,'PROVIDER_MARKET_MISMATCH');
const txse={...good,chart:{...good.chart,result:[{...good.chart.result[0],meta:{...good.chart.result[0].meta,exchangeName:'TEX',fullExchangeName:'TXSE',symbol:'TCBI'}}]}};
assert.equal(inspectYahooChart(txse,{...p,mic:'TXSE',providerTicker:'TCBI'}).status,'DATED_OHLC_RESEARCH_ONLY');
assert.equal(inspectYahooChart(txse,{...p,mic:'XNYS',providerTicker:'TCBI'}).status,'PROVIDER_MARKET_MISMATCH');
assert.equal(inspectYahooChart({...txse,chart:{...txse.chart,result:[{...txse.chart.result[0],meta:{...txse.chart.result[0].meta,fullExchangeName:'NYSE'}}]}},{...p,mic:'TXSE',providerTicker:'TCBI'}).status,'PROVIDER_MARKET_MISMATCH');
assert.equal(inspectYahooChart(good,{...p,providerTicker:'AAPL'}).status,'PROVIDER_SYMBOL_MISMATCH');
assert.equal(inspectYahooChart({...good,chart:{...good.chart,result:[{...good.chart.result[0],meta:{...good.chart.result[0].meta,currency:'EUR'}}]}},p).status,'PROVIDER_IDENTITY_MISMATCH');
assert.equal(inspectYahooChart({...good,chart:{...good.chart,result:[{...good.chart.result[0],indicators:{quote:[{open:[0],high:[103],low:[99],close:[101],volume:[1000]}]}}]}},p).status,'INVALID_OHLCV');
assert.equal(inspectYahooChart({...good,chart:{...good.chart,result:[{...good.chart.result[0],timestamp:[Date.parse('2026-10-10T20:00:00Z')/1000]}]}},p).status,'NO_DATED_BAR');
assert.equal(inspectYahooChart({...good,chart:{...good.chart,result:[{...good.chart.result[0],timestamp:[ts,ts]}]}},p).status,'DUPLICATE_SESSION_BAR');
console.log('USA dated daily canary regressions passed: 19');

const c={session:'2026-10-16'},r=(mic,date=c.session,status='DATED_OHLC_RESEARCH_ONLY')=>({
 symbol:mic==='XNYS'?'MMM':mic==='XNAS'?'AAPL':'TCBI',
 category:mic==='TXSE'?'txse_listed_flag':'large',
 mic,date,status,open:100,high:103,low:99,close:101,volume:1000,
 catalogStatus:'COMMON_CANDIDATE_NOT_VERIFIED',catalogSecurityType:'COMMON_CANDIDATE',
 providerTicker:mic==='XNYS'?'MMM':mic==='XNAS'?'AAPL':'TCBI',
 providerSymbol:mic==='XNYS'?'MMM':mic==='XNAS'?'AAPL':'TCBI',
 providerExchange:mic==='XNYS'?'NYQ':mic==='XNAS'?'NMS':'TEX',
 providerFullExchange:mic==='TXSE'?'TXSE':null,
 providerCurrency:'USD',providerType:'EQUITY',providerTimezone:'America/New_York'
});
const assertMicEvidence=output=>assertCurrentCanaryEvidence(output,SAMPLES.filter(s=>['MMM','AAPL','TCBI'].includes(s.symbol)));
assert.throws(()=>assertMicEvidence({coverage:c,results:[]}),/XNYS:MMM,XNAS:AAPL,TXSE:TCBI/);
assert.throws(()=>assertMicEvidence({coverage:c,results:[r('XNYS')]}),/XNAS:AAPL,TXSE:TCBI/);
assert.throws(()=>assertMicEvidence({coverage:c,results:[r('XNYS'),r('XNAS'),r('TXSE','2026-10-15')]}),/TXSE/);
assert.throws(()=>assertMicEvidence({coverage:c,results:[r('XNYS'),r('XNAS'),r('TXSE',c.session,'PREVIOUS_SESSION_ONLY')]}),/TXSE/);
assert.throws(()=>assertMicEvidence({coverage:c,results:[r('XNYS'),r('XNAS'),{...r('TXSE'),open:0}]}),/TXSE/);
assert.throws(()=>assertMicEvidence({coverage:{session:'bad'},results:[]}),/MALFORMED/);
assert.equal(assertMicEvidence({coverage:c,results:[r('XNYS'),r('XNAS'),r('TXSE')]}),true);
// Financial-status and security-type quarantine must never satisfy a current-session gate.
for(const mic of ['XNYS','XNAS','TXSE']){
 const base={securityType:'COMMON_CANDIDATE',catalogStatus:'COMMON_CANDIDATE_NOT_VERIFIED',status:'COMMON_CANDIDATE_NOT_VERIFIED'};
 assert.equal(canProbeCatalogCandidate(base,mic),true);
 assert.equal(canProbeCatalogCandidate({...base,securityType:'ADR'},mic),false);
 assert.equal(canProbeCatalogCandidate({...base,[mic==='TXSE'?'status':'catalogStatus']:'QUARANTINE_FINANCIAL_STATUS'},mic),false);
 assert.equal(canProbeCatalogCandidate({...base,[mic==='TXSE'?'status':'catalogStatus']:undefined},mic),false);
}
assert.throws(()=>assertMicEvidence({coverage:c,results:[r('XNYS'),{...r('XNAS'),catalogStatus:'QUARANTINE_FINANCIAL_STATUS'},r('TXSE')]}),/XNAS/);
assert.throws(()=>assertMicEvidence({coverage:c,results:[{...r('XNYS'),catalogSecurityType:'ADR'},r('XNAS'),r('TXSE')]}),/XNYS/);
assert.throws(()=>assertMicEvidence({coverage:c,results:[r('XNYS'),r('XNAS'),{...r('TXSE'),catalogStatus:undefined}]}),/TXSE/);
console.log('USA current-session fail-closed canary evidence regressions passed');

// A research-only bar must never make CI green without complete OHLCV and provider identity.
for(const mic of ['XNYS','XNAS','TXSE']){
 const valid=['XNYS','XNAS','TXSE'].map(rmic=>r(rmic));
 const invalid=[
  {high:undefined},{low:undefined},{volume:undefined},{high:100},{low:102},
  {volume:-1},{providerTicker:undefined},{providerSymbol:'OTHER'},
  {providerExchange:'WRONG'},{providerCurrency:'EUR'},{providerType:'ETF'},
  {providerTimezone:'UTC'},{date:'2026-10-15'}
 ];
 for(const patch of invalid){
  const rows=valid.map(row=>row.mic===mic?{...row,...patch}:row);
  assert.throws(()=>assertMicEvidence({coverage:c,results:rows}),new RegExp(mic));
 }
}
assert.throws(()=>assertMicEvidence({coverage:c,results:[r('XNYS'),r('XNAS'),{...r('TXSE'),providerFullExchange:'NYSE'}]}),/TXSE/);
console.log('USA OHLCV and provider-identity fail-closed regressions passed');


// CI must fail if even one configured difficult sample is missing, stale, malformed or duplicated.
const fullRows=SAMPLES.map(sample=>({...r(sample.mic),...sample,providerSymbol:sample.providerTicker}));
assert.equal(assertCurrentCanaryEvidence({coverage:c,results:fullRows}),true);
assert.throws(()=>assertCurrentCanaryEvidence({coverage:c,results:[r('XNYS'),r('XNAS'),r('TXSE')]}),/XNYS:AMC/);
assert.throws(()=>assertCurrentCanaryEvidence({coverage:c,results:fullRows},[]),/EXPECTATIONS_INVALID/);
for(const sample of SAMPLES){
 const key=sample.mic+':'+sample.symbol;
 const row=fullRows.find(x=>x.mic===sample.mic&&x.symbol===sample.symbol);
 const remaining=fullRows.filter(x=>x!==row);
 assert.throws(()=>assertCurrentCanaryEvidence({coverage:c,results:remaining}),e=>e.message.includes(key));
 assert.throws(()=>assertCurrentCanaryEvidence({coverage:c,results:[...fullRows,row]}),e=>e.message.includes(key));
 for(const patch of [{volume:undefined},{catalogStatus:'QUARANTINE_SECURITY_TYPE'},{providerTicker:'OTHER'},{category:'OTHER'},{date:'2026-10-15'}]){
  const altered=fullRows.map(x=>x===row?{...x,...patch}:x);
  assert.throws(()=>assertCurrentCanaryEvidence({coverage:c,results:altered}),e=>e.message.includes(key));
 }
}
console.log('USA all configured per-symbol difficult canary evidence regressions passed');
