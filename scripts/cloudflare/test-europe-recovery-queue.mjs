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


const sourceIntegrityUpdates=[{markets:[
 {mic:'XLON',failed:[
  {isin:'GB0000000002',symbol:'CONFLICT',error:'Alle providers faalden voor GB0000000002: yahoo-chart: Source duplicate-date OHLC conflict'},
  {isin:'GB0000000003',symbol:'MIXED',error:'Alle providers faalden voor GB0000000003: yahoo-chart: Source exact-date OHLC mixes complete and invalid duplicate bars'},
  {isin:'GB0000000004',symbol:'NOBAR',error:'Alle providers faalden voor GB0000000004: yahoo-chart: Source has no exact-date daily bar'},
  {isin:'GB0000000005',symbol:'INVALID',error:'Alle providers faalden voor GB0000000005: yahoo-chart: Source exact-date OHLC incomplete or inconsistent'}
 ]},
 {mic:'XSWX',failed:[{isin:'CH0000000001',symbol:'12345678',error:'Alle providers faalden voor CH0000000001: yahoo-chart: Source duplicate-date OHLC conflict'}]}
]}];
const sourceIntegrityAudits=[{markets:[
 {mic:'XLON',missing:[
  {isin:'GB0000000002',symbol:'CONFLICT',reason:'STALE_LAST_TRADE'},
  {isin:'GB0000000003',symbol:'MIXED',reason:'STALE_LAST_TRADE'},
  {isin:'GB0000000004',symbol:'NOBAR',reason:'STALE_LAST_TRADE'},
  {isin:'GB0000000005',symbol:'INVALID',reason:'INCOMPLETE_OR_INVALID_OHLC'}
 ]},
 {mic:'XSWX',missing:[{isin:'CH0000000001',symbol:'12345678',reason:'STALE_LAST_TRADE'}]}
]}];
const sourceIntegrityQueue=buildEuropeRecoveryQueue(sourceIntegrityUpdates,sourceIntegrityAudits);
const londonIntegrity=sourceIntegrityQueue.markets.find(m=>m.mic==='XLON');
assert.equal(londonIntegrity.instruments.find(x=>x.symbol==='CONFLICT').workstream,'REVIEW_QUARANTINED_SOURCE_OHLC');
assert.equal(londonIntegrity.instruments.find(x=>x.symbol==='MIXED').workstream,'REVIEW_QUARANTINED_SOURCE_OHLC');
assert.equal(londonIntegrity.instruments.find(x=>x.symbol==='NOBAR').workstream,'VERIFY_LAST_OFFICIAL_TRADE','An absent exact-date bar does not establish a source OHLC conflict');
assert.equal(londonIntegrity.instruments.find(x=>x.symbol==='INVALID').workstream,'REPAIR_INCOMPLETE_OHLC','Stored invalid OHLC retains its separate append-only review');
assert.equal(londonIntegrity.instruments[0].priority,96,'Quarantined source conflicts outrank ordinary stale-date checks');
assert.equal(sourceIntegrityQueue.markets.find(m=>m.mic==='XSWX').instruments[0].workstream,'VERIFY_SIX_VALOR_TO_CURRENT_TICKER','Unverified SIX identity must remain blocked before any source use');
assert.equal(sourceIntegrityQueue.totals.missing,5);
console.log('Quarantined duplicate-date source bars receive evidence-only triage; no-bar and unverified SIX identity remain distinct PASS');

\nconst storedConflictAudit=[{markets:[{mic:'XLON',missing:[],storedOhlcConflictCandidates:[
 {isin:'GB0000000042',symbol:'ABC',date:'2026-10-22',category:'MIXED_COMPLETE_INVALID_STORED_OHLC',rows:2,distinctOhlc:2}
]}]}];
const storedConflicts=buildEuropeRecoveryQueue([],storedConflictAudit);
assert.equal(storedConflicts.totals.missing,0,'Stored conflicts do not create fabricated missing current prices');
assert.equal(storedConflicts.totals.recentOhlcDebtDates,0,'Stored conflicts are not counted as incomplete candle debt');
assert.equal(storedConflicts.totals.storedOhlcConflictDates,1);
assert.equal(storedConflicts.markets[0].storedOhlcConflicts[0].evidenceScope,'STORED_SAME_DATE_CONFLICT');
assert.match(storedConflicts.markets[0].storedOhlcConflicts[0].repairPolicy,/APPEND_ONLY/);
console.log('Stored same-date conflict queue remains read-only and separate from current/history debt PASS');
