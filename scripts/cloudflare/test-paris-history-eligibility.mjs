import assert from 'node:assert/strict';
import {hasRecordedHistory,parisHistoryEligible} from './paris-history-eligibility.mjs';

const policy={mode:'existing-history-only',mics:['XPAR','ALXP','XMLI']};
const manifest={
  'XPAR-EXISTING':{lastDate:'2026-10-22',recordCount:350},
  'ALXP-LEGACY':{lastDate:'2026-10-20',records:8},
  'XPAR-SHELL':{lastDate:'2026-10-22',recordCount:0},
  'XPAR-EMPTY':{recordCount:14},
  'XPAR-UNKNOWN':{lastDate:'2026-10-22'}
};
const resolver=s=>s.storageKey||s.isin;
assert.equal(hasRecordedHistory(manifest['XPAR-EXISTING']),true);
assert.equal(hasRecordedHistory(manifest['ALXP-LEGACY']),true);
for(const key of ['XPAR-SHELL','XPAR-EMPTY','XPAR-UNKNOWN'])assert.equal(hasRecordedHistory(manifest[key]),false,key);
assert.equal(hasRecordedHistory({lastDate:'2026-10-22',records:'0'}),false);
assert.equal(hasRecordedHistory({lastDate:'invalid',records:50}),false);
assert.equal(parisHistoryEligible({isin:'XPAR-EXISTING'},'XPAR',policy,manifest,resolver),true);
assert.equal(parisHistoryEligible({isin:'ALXP-LEGACY',mic:'ALXP'},'XPAR',policy,manifest,resolver),true);
for(const key of ['XPAR-SHELL','XPAR-EMPTY','XPAR-UNKNOWN','XPAR-NOT-FOUND'])
  assert.equal(parisHistoryEligible({isin:key},'XPAR',policy,manifest,resolver),false,key);
assert.equal(parisHistoryEligible({isin:'XPAR-SHELL'},'XLON',policy,manifest,resolver),true,'Non-Paris unaffected');
assert.equal(parisHistoryEligible({isin:'XPAR-SHELL'},'XPAR',{...policy,mode:'unrestricted'},manifest,resolver),true);
assert.equal(parisHistoryEligible({isin:'ANY',storageKey:'XPAR-EXISTING'},'XPAR',policy,manifest,resolver),true,'Existing storage key remains authoritative');
console.log('Paris existing-history-only positive-record eligibility: PASS');
