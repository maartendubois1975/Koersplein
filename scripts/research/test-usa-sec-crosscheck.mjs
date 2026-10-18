import assert from 'node:assert/strict';
import {crosscheckSecIssuer} from './usa-sec-crosscheck-core.mjs';
const common=(symbol,overrides={})=>({symbol,catalogStatus:'COMMON_CANDIDATE_NOT_VERIFIED',securityType:'COMMON_CANDIDATE',...overrides});
const sec={fields:['cik','name','ticker','exchange'],data:[
  [320193,'Apple Inc.','AAPL','Nasdaq'],
  [1321655,'Palantir Technologies Inc.','PLTR','Nasdaq'],
  [316709,'SCHWAB CHARLES CORP','SCHW','NYSE'],
  [1234,'Duplicate A','DUP','NYSE'],[5678,'Duplicate B','DUP','NYSE'],
  [9999,'Another','OTHER','Nasdaq']]};
const catalog={exchange:'XNAS',securities:[common('AAPL'),common('PLTR',{issuerCIK:'0001321655'}),
  common('SCHW'),common('DUP'),common('MISSING'),common('ADR',{catalogStatus:'QUARANTINE_SECURITY_TYPE',securityType:'ADR'})]};
const result=crosscheckSecIssuer(catalog,sec,'XNAS',{observedAt:'2026-10-18T00:00:00Z'});
const find=s=>result.records.find(r=>r.symbol===s);
assert.equal(find('AAPL').secIssuerCIKCandidate,'0000320193');
assert.equal(find('PLTR').secIssuerCIKCandidate,'0001321655');
assert.equal(find('SCHW').status,'SEC_EXCHANGE_MISMATCH_REVIEW');
assert.equal(find('SCHW').secIssuerCIKCandidate,null);
assert.equal(find('DUP').status,'SEC_TICKER_AMBIGUOUS');
assert.equal(find('MISSING').status,'SEC_TICKER_NOT_FOUND');
assert.equal(find('ADR').status,'EXCLUDED_OR_QUARANTINED');
assert.equal(find('ADR').secIssuerCIKCandidate,null);
assert.ok(result.records.every(x=>!x.isinVerified&&!x.shareClassVerified&&!x.activeTradingVerified&&!x.eligibleForTraining));
assert.equal(result.verifiedCommonStocks,0);
assert.equal(result.statusCounts.SEC_EXACT_TICKER_EXCHANGE_CIK_CANDIDATE,2);
assert.throws(()=>crosscheckSecIssuer({...catalog,exchange:'XNYS'},sec,'XNAS'),/SEC_INVALID_CATALOG/);
assert.throws(()=>crosscheckSecIssuer(catalog,{...sec,fields:['ticker','cik','name','exchange']},'XNAS'),/SEC_INVALID_OFFICIAL_SCHEMA/);
assert.throws(()=>crosscheckSecIssuer(catalog,{...sec,data:[[0,'Bad','BAD','NYSE']]},'XNAS'),/SEC_INVALID_ROW/);
assert.throws(()=>crosscheckSecIssuer({...catalog,securities:[common('AAPL'),common('AAPL')]},sec,'XNAS'),/SEC_DUPLICATE_OR_INVALID_CATALOG_SYMBOL/);
assert.throws(()=>crosscheckSecIssuer({...catalog,securities:[common('PLTR',{issuerCIK:'0000000001'})]},sec,'XNAS'),/SEC_EXISTING_CIK_CONFLICT/);
const nyse=crosscheckSecIssuer({exchange:'XNYS',securities:[common('SCHW')]},sec,'XNYS');
assert.equal(nyse.records[0].secIssuerCIKCandidate,'0000316709');
console.log('USA SEC research-only crosscheck offline regressions passed');
