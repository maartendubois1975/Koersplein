import assert from 'node:assert/strict';
import {buildEuropeRecoveryQueue} from './europe-recovery-queue.mjs';

const updates=[{markets:[
 {mic:'XSWX',failed:[{isin:'AT0000KTMI02',symbol:'41860974',error:'Alle providers faalden voor AT0000KTMI02: yahoo-isin-resolver: Geen Yahoo ISIN-resolutie voor AT0000KTMI02'}]},
 {mic:'XLON',failed:[{isin:'GB00BMXTZ463',symbol:'ZAIM',error:'Alle providers faalden voor GB00BMXTZ463: yahoo-chart: Provider returned no daily bars'}]}
]}];
const audits=[{markets:[
 {mic:'XSWX',missing:[{isin:'AT0000KTMI02',symbol:'41860974',lastDate:'2026-01-01',reason:'MISSING_INVALID_OR_STALE_OHLC'}]},
 {mic:'XLON',missing:[
  {isin:'GB00BMXTZ463',symbol:'ZAIM',lastDate:'2026-10-01',reason:'MISSING_INVALID_OR_STALE_OHLC',knownDataUnavailable:'SOURCE_PREFLIGHT_GATE'},
  {isin:'GB0000000001',symbol:'A',reason:'NO_HISTORY_PARTITIONS'}
 ]}
]}];
const queue=buildEuropeRecoveryQueue(updates,audits);
assert.equal(queue.totals.missing,3);
assert.equal(queue.totals.numericSwissValor,1);
assert.equal(queue.totals.knownDataUnavailable,1);
assert.equal(queue.markets[0].mic,'XLON');
assert.equal(queue.markets[0].missing,2);
assert.equal(queue.markets[1].mic,'XSWX');
const swiss=queue.markets[1].instruments[0];
assert.equal(swiss.workstream,'VERIFY_SIX_VALOR_TO_CURRENT_TICKER');
assert.equal(swiss.lastStoredDate,'2026-01-01');
assert.equal(swiss.attempts[0].provider,'yahoo-isin-resolver');
const london=queue.markets[0].instruments.find(x=>x.isin==='GB00BMXTZ463');
assert.equal(london.workstream,'VERIFY_LAST_OFFICIAL_TRADE');
assert.equal(london.knownDataUnavailable,'SOURCE_PREFLIGHT_GATE');
assert.equal(queue.markets[0].instruments.find(x=>x.isin==='GB0000000001').workstream,'REPAIR_STORAGE_IDENTITY_OR_ARCHIVE');
assert.ok(queue.warning.includes('does not prove no trading'));
console.log('Europe recovery queue: audited gaps, provider attempts, SIX valor and historic DATA_UNAVAILABLE evidence PASS');

const debtAudit=[{markets:[{mic:'XLON',missing:[],recentOhlcDebtCandidates:[
 {isin:'GB0000000001',symbol:'A',date:'2026-10-20',defects:['MISSING_HIGH']},
 {isin:'GB0000000001',symbol:'A',date:'2026-10-21',defects:['LOW_ABOVE_CLOSE']}
]}]}];
const historical=buildEuropeRecoveryQueue([],debtAudit);
assert.equal(historical.totals.missing,0,'A valid latest candle must remain current');
assert.equal(historical.totals.recentOhlcDebtDates,2,'Older incomplete candles remain repair debt');
assert.equal(historical.markets[0].recentOhlcDebt.length,2);
assert.equal(historical.markets[0].recentOhlcDebt[0].evidenceScope,'RECENT_STORED_HISTORY');
assert.equal(historical.markets[0].recentOhlcDebt[1].lastStoredDate,'2026-10-21');
assert.equal(historical.markets[0].recentOhlcDebt[0].repairPolicy,'READ_ONLY_VERIFICATION_REQUIRED_APPEND_ONLY_PRESERVES_EXISTING_BAR');
console.log('Historical OHLC repair debt retained independently from current daily status PASS');
